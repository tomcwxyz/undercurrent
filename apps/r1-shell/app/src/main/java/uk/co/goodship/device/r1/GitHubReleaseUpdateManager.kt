package uk.co.goodship.device.r1

import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import org.json.JSONObject

private const val CONNECT_TIMEOUT_MS = 10_000
private const val READ_TIMEOUT_MS = 30_000

private data class ReleaseManifest(
    val versionCode: Long,
    val versionName: String,
    val apkUrl: String,
    val assetName: String,
    val sha256: String,
    val apkSize: Long,
    val required: Boolean,
)

class GitHubReleaseUpdateManager(
    private val activity: Activity,
    private val config: ReleaseUpdateConfig,
    private val productName: String,
    private val userAgentProduct: String,
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val preferences =
        activity.getSharedPreferences(config.preferenceKey, Activity.MODE_PRIVATE)

    @Volatile
    private var checking = false

    @Volatile
    private var installing = false

    private var offeredVersionCode: Long? = null
    private var awaitingInstallPermission = false

    fun onResume() {
        val force = awaitingInstallPermission
        awaitingInstallPermission = false
        checkForUpdates(force = force)
    }

    fun shutdown() {
        executor.shutdownNow()
    }

    fun checkForUpdates(force: Boolean = false) {
        if (checking || installing) return

        val now = System.currentTimeMillis()
        val lastCheck = preferences.getLong("last-check-ms", 0L)
        if (!force && now - lastCheck < config.checkIntervalMs) return

        checking = true
        preferences.edit().putLong("last-check-ms", now).apply()

        executor.execute {
            try {
                val manifest = fetchManifest() ?: return@execute
                if (manifest.versionCode <= currentVersionCode()) return@execute

                main.post {
                    if (!activity.isFinishing && !activity.isDestroyed) {
                        offerUpdate(manifest)
                    }
                }
            } catch (_: Exception) {
                // Update checks are best effort; the product remains usable offline.
            } finally {
                checking = false
            }
        }
    }

    private fun currentVersionCode(): Long {
        val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }
    }

    private fun currentVersionName(): String {
        return activity.packageManager
            .getPackageInfo(activity.packageName, 0)
            .versionName
            ?: "unknown"
    }

    private fun fetchManifest(): ReleaseManifest? {
        val connection =
            URL(config.releaseApiUrl).openConnection() as HttpURLConnection

        return connection.use {
            requestMethod = "GET"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty(
                "User-Agent",
                userAgentProduct + "/" + currentVersionName(),
            )

            if (responseCode !in 200..299) return null

            val body =
                inputStream.bufferedReader().use { reader -> reader.readText() }
            val release = JSONObject(body)
            val manifestText = release.optString("body").trim()
            if (manifestText.isEmpty()) return null

            val manifest = JSONObject(manifestText)
            val versionCode = manifest.optLong("versionCode", -1L)
            val versionName = manifest.optString("versionName").trim()
            val assetName = manifest.optString("assetName").trim()
            val sha256 = manifest.optString("sha256").trim().lowercase()
            val apkSize = manifest.optLong("apkSize", -1L)

            if (
                versionCode <= 0L ||
                versionName.isEmpty() ||
                assetName.isEmpty() ||
                !sha256.matches(Regex("^[a-f0-9]{64}$")) ||
                apkSize <= 0L ||
                apkSize > config.maxApkBytes
            ) {
                return null
            }

            val assets = release.optJSONArray("assets") ?: return null
            var apkUrl: String? = null
            for (index in 0 until assets.length()) {
                val asset = assets.optJSONObject(index) ?: continue
                if (asset.optString("name") == assetName) {
                    apkUrl = asset.optString("browser_download_url").trim()
                    break
                }
            }

            if (apkUrl.isNullOrEmpty() || !apkUrl.startsWith("https://")) {
                return null
            }

            ReleaseManifest(
                versionCode = versionCode,
                versionName = versionName,
                apkUrl = apkUrl,
                assetName = assetName,
                sha256 = sha256,
                apkSize = apkSize,
                required = manifest.optBoolean("required", false),
            )
        }
    }

    private fun offerUpdate(manifest: ReleaseManifest) {
        if (offeredVersionCode == manifest.versionCode || installing) return
        offeredVersionCode = manifest.versionCode

        val message =
            "$productName ${manifest.versionName} is ready. Download it now and Android will ask you to approve the install."

        AlertDialog.Builder(activity)
            .setTitle("$productName update")
            .setMessage(message)
            .setPositiveButton("Update") { _, _ ->
                if (canInstallPackages()) {
                    downloadAndInstall(manifest)
                } else {
                    offeredVersionCode = null
                    awaitingInstallPermission = true
                    requestInstallPermission()
                }
            }
            .setNegativeButton(if (manifest.required) "Not now" else "Later") { _, _ ->
                offeredVersionCode = null
            }
            .setOnCancelListener {
                offeredVersionCode = null
            }
            .show()
    }

    private fun canInstallPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            activity.packageManager.canRequestPackageInstalls()
    }

    private fun requestInstallPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${activity.packageName}"),
        )
        activity.startActivity(intent)
    }

    private fun downloadAndInstall(manifest: ReleaseManifest) {
        if (installing) return
        installing = true

        executor.execute {
            try {
                val apk = downloadApk(manifest)
                verifyApk(apk, manifest)
                main.post {
                    try {
                        installApk(apk, manifest)
                    } catch (_: Exception) {
                        installing = false
                        offeredVersionCode = null
                    }
                }
            } catch (_: Exception) {
                installing = false
                offeredVersionCode = null
            }
        }
    }

    private fun downloadApk(manifest: ReleaseManifest): File {
        if (manifest.apkSize > config.maxApkBytes) {
            throw IllegalStateException("Update APK is unexpectedly large")
        }

        val target = File(activity.cacheDir, manifest.assetName)
        val connection =
            URL(manifest.apkUrl).openConnection() as HttpURLConnection

        connection.use {
            requestMethod = "GET"
            connectTimeout = CONNECT_TIMEOUT_MS
            readTimeout = READ_TIMEOUT_MS
            setRequestProperty(
                "Accept",
                "application/vnd.android.package-archive",
            )
            setRequestProperty(
                "User-Agent",
                userAgentProduct + "/" + currentVersionName(),
            )

            if (responseCode !in 200..299) {
                throw IllegalStateException("Could not download update")
            }

            inputStream.use { input ->
                target.outputStream().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var total = 0L

                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > config.maxApkBytes) {
                            throw IllegalStateException(
                                "Update APK exceeded size limit",
                            )
                        }
                        output.write(buffer, 0, count)
                    }
                }
            }
        }

        return target
    }

    private fun verifyApk(
        apk: File,
        manifest: ReleaseManifest,
    ) {
        if (apk.length() != manifest.apkSize) {
            apk.delete()
            throw IllegalStateException("Update APK size mismatch")
        }

        val digest = MessageDigest.getInstance("SHA-256")
        apk.inputStream().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }

        val actual =
            digest.digest().joinToString("") { byte -> "%02x".format(byte) }
        if (!actual.equals(manifest.sha256, ignoreCase = true)) {
            apk.delete()
            throw IllegalStateException("Update APK checksum mismatch")
        }
    }

    private fun installApk(
        apk: File,
        manifest: ReleaseManifest,
    ) {
        val packageInstaller = activity.packageManager.packageInstaller
        val params =
            PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL,
            ).apply {
                setAppPackageName(activity.packageName)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    setPackageSource(
                        PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE,
                    )
                }
            }

        val sessionId = packageInstaller.createSession(params)
        packageInstaller.openSession(sessionId).use { session ->
            apk.inputStream().use { input ->
                session.openWrite(
                    manifest.assetName,
                    0,
                    apk.length(),
                ).use { output ->
                    input.copyTo(output)
                    session.fsync(output)
                }
            }

            val resultIntent =
                Intent(activity, UpdateInstallReceiver::class.java).apply {
                    action = "uk.co.goodship.device.r1.UPDATE_RESULT"
                }

            val flags =
                PendingIntent.FLAG_UPDATE_CURRENT or
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        PendingIntent.FLAG_MUTABLE
                    } else {
                        0
                    }

            val pendingIntent =
                PendingIntent.getBroadcast(
                    activity,
                    sessionId,
                    resultIntent,
                    flags,
                )

            session.commit(pendingIntent.intentSender)
        }
    }

    private inline fun <T> HttpURLConnection.use(
        block: HttpURLConnection.() -> T,
    ): T {
        return try {
            block()
        } finally {
            disconnect()
        }
    }
}
