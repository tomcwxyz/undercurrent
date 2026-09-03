package uk.co.goodship.device.r1

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

private const val AUDIO_PERMISSION_REQUEST = 1001

abstract class GoodShipR1Activity : Activity(), TextToSpeech.OnInitListener {
    protected abstract val shellConfig: ShellConfig

    private lateinit var webView: WebView
    private var textToSpeech: TextToSpeech? = null
    private var textToSpeechReady = false
    private var textToSpeechSuspendedForCapture = false
    private var pendingSpeech: String? = null
    private var voiceRecorder: MediaRecorder? = null
    private var voiceRecordingFile: File? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var returningFromAuth = false
    private var updateManager: GitHubReleaseUpdateManager? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        initialiseTextToSpeech()

        webView = WebView(this).apply {
            setBackgroundColor(
                Color.rgb(
                    shellConfig.backgroundRed,
                    shellConfig.backgroundGreen,
                    shellConfig.backgroundBlue,
                ),
            )
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.textZoom = 100
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportMultipleWindows(false)
            settings.userAgentString =
                settings.userAgentString + " " + shellConfig.userAgentProduct + "/" + currentVersionName()

            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)

            addJavascriptInterface(DeviceBridge(), shellConfig.bridgeName)

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    val wantsAudio =
                        request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    if (!wantsAudio) {
                        request.deny()
                        return
                    }

                    if (
                        checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                        PackageManager.PERMISSION_GRANTED
                    ) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } else {
                        pendingWebPermission?.deny()
                        pendingWebPermission = request
                        requestPermissions(
                            arrayOf(Manifest.permission.RECORD_AUDIO),
                            AUDIO_PERMISSION_REQUEST,
                        )
                    }
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val uri = request.url
                    if (
                        uri.scheme == "https" &&
                        uri.host != null &&
                        shellConfig.trustedHosts.contains(uri.host)
                    ) {
                        return false
                    }

                    if (uri.scheme == "http" || uri.scheme == "https") {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        return true
                    }

                    return false
                }

                override fun onPageFinished(view: WebView, url: String) {
                    val uri = Uri.parse(url)
                    val trusted =
                        uri.host != null && shellConfig.trustedHosts.contains(uri.host)

                    if (trusted && uri.path == shellConfig.signInPath) {
                        returningFromAuth = true
                    } else if (
                        returningFromAuth &&
                        trusted &&
                        uri.path.orEmpty().startsWith(shellConfig.authSuccessPathPrefix)
                    ) {
                        returningFromAuth = false
                        view.loadUrl(shellConfig.initialUrl)
                        return
                    } else if (
                        trusted &&
                        uri.path.orEmpty().startsWith(Uri.parse(shellConfig.initialUrl).path.orEmpty())
                    ) {
                        returningFromAuth = false
                    }

                    val datasetKey = JSONObject.quote(shellConfig.datasetKey)
                    val eventName = JSONObject.quote(shellConfig.eventPrefix + ":native-shell-ready")
                    view.evaluateJavascript(
                        "document.documentElement.dataset[" + datasetKey + "]='android';" +
                            "window.dispatchEvent(new CustomEvent(" + eventName + "));",
                        null,
                    )
                }
            }

            if (savedInstanceState == null) {
                loadUrl(shellConfig.initialUrl)
            } else {
                restoreState(savedInstanceState)
            }
        }

        WebView.setWebContentsDebuggingEnabled(false)
        setContentView(webView)
        updateManager = shellConfig.update?.let { update ->
            GitHubReleaseUpdateManager(
                activity = this,
                config = update,
                productName = shellConfig.productName,
                userAgentProduct = shellConfig.userAgentProduct,
            )
        }
        scheduleImmersiveMode()

        if (
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(Manifest.permission.RECORD_AUDIO),
                AUDIO_PERMISSION_REQUEST,
            )
        }
    }

    private fun currentVersionName(): String {
        return packageManager
            .getPackageInfo(packageName, 0)
            .versionName
            ?: "unknown"
    }

    private fun initialiseTextToSpeech() {
        if (textToSpeech != null || textToSpeechSuspendedForCapture) return
        textToSpeechReady = false
        textToSpeech = TextToSpeech(this, this)
    }

    private fun suspendTextToSpeechForCapture() {
        pendingSpeech = null
        textToSpeechSuspendedForCapture = true
        textToSpeechReady = false
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        notifyNativeTts(started = false)
    }

    private fun resumeTextToSpeechAfterCapture() {
        if (!textToSpeechSuspendedForCapture) return
        textToSpeechSuspendedForCapture = false
        initialiseTextToSpeech()
    }

    @Suppress("DEPRECATION")
    private fun createVoiceRecorder(): MediaRecorder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(this)
        } else {
            MediaRecorder()
        }
    }

    private fun startNativeVoiceRecorder(): String {
        if (
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return "permission_denied"
        }

        if (voiceRecorder != null) return "already_recording"

        val latch = CountDownLatch(1)
        var result = "error:unknown"

        runOnUiThread {
            try {
                suspendTextToSpeechForCapture()

                val output = File(
                    cacheDir,
                    shellConfig.eventPrefix + "-voice-" + System.currentTimeMillis() + ".m4a",
                )
                val recorder = createVoiceRecorder().apply {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    setAudioEncodingBitRate(64_000)
                    setAudioSamplingRate(44_100)
                    setOutputFile(output.absolutePath)
                    prepare()
                    start()
                }

                voiceRecordingFile = output
                voiceRecorder = recorder
                result = "started"
            } catch (error: Exception) {
                voiceRecorder?.release()
                voiceRecorder = null
                voiceRecordingFile?.delete()
                voiceRecordingFile = null
                resumeTextToSpeechAfterCapture()
                result =
                    "error:" +
                    error.javaClass.simpleName +
                    ":" +
                    (error.message ?: "Could not start native recorder").take(180)
            } finally {
                latch.countDown()
            }
        }

        if (!latch.await(5, TimeUnit.SECONDS)) {
            return "error:timeout:Native recorder did not start in time"
        }

        return result
    }

    private fun stopNativeVoiceRecorder(cancel: Boolean): String {
        if (voiceRecorder == null) {
            resumeTextToSpeechAfterCapture()
            return JSONObject()
                .put("ok", false)
                .put("error", "not_recording")
                .toString()
        }

        val latch = CountDownLatch(1)
        var result = JSONObject()
            .put("ok", false)
            .put("error", "unknown")
            .toString()

        runOnUiThread {
            val recorder = voiceRecorder
            val output = voiceRecordingFile
            voiceRecorder = null
            voiceRecordingFile = null

            try {
                if (!cancel) recorder?.stop()
                recorder?.release()

                if (
                    cancel ||
                    output == null ||
                    !output.exists() ||
                    output.length() == 0L
                ) {
                    output?.delete()
                    result = JSONObject()
                        .put("ok", false)
                        .put("error", if (cancel) "cancelled" else "empty_recording")
                        .toString()
                } else {
                    val bytes = output.readBytes()
                    output.delete()
                    result = JSONObject()
                        .put("ok", true)
                        .put("mimeType", "audio/mp4")
                        .put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                        .toString()
                }
            } catch (error: Exception) {
                try {
                    recorder?.reset()
                    recorder?.release()
                } catch (_: Exception) {
                    // Best-effort release after recorder failure.
                }
                output?.delete()
                result = JSONObject()
                    .put("ok", false)
                    .put(
                        "error",
                        error.javaClass.simpleName +
                            ":" +
                            (error.message ?: "Could not finish native recording").take(180),
                    )
                    .toString()
            } finally {
                resumeTextToSpeechAfterCapture()
                latch.countDown()
            }
        }

        if (!latch.await(8, TimeUnit.SECONDS)) {
            return JSONObject()
                .put("ok", false)
                .put("error", "timeout")
                .toString()
        }

        return result
    }

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) {
            textToSpeechReady = false
            pendingSpeech = null
            return
        }

        textToSpeech?.language = Locale.UK
        textToSpeech?.setSpeechRate(1.02f)
        textToSpeech?.setOnUtteranceProgressListener(
            object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) =
                    notifyNativeTts(started = true)

                override fun onDone(utteranceId: String?) =
                    notifyNativeTts(started = false)

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) =
                    notifyNativeTts(started = false)

                override fun onError(utteranceId: String?, errorCode: Int) =
                    notifyNativeTts(started = false)
            },
        )

        if (textToSpeechSuspendedForCapture || textToSpeech == null) {
            textToSpeechReady = false
            return
        }

        textToSpeechReady = true

        pendingSpeech?.let { queued ->
            pendingSpeech = null
            speakNow(queued)
        }
    }

    private fun speakNow(clean: String) {
        textToSpeech?.speak(
            clean,
            TextToSpeech.QUEUE_FLUSH,
            null,
            shellConfig.eventPrefix + "-" + UUID.randomUUID().toString(),
        )
    }

    private fun notifyNativeTts(started: Boolean) {
        if (!::webView.isInitialized) return

        runOnUiThread {
            val event =
                shellConfig.eventPrefix +
                if (started) ":native-tts-start" else ":native-tts-end"
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent(" + JSONObject.quote(event) + "));",
                null,
            )
        }
    }

    inner class DeviceBridge {
        @JavascriptInterface
        fun speak(text: String) {
            val clean = text.trim().take(12_000)
            if (clean.isEmpty()) return

            runOnUiThread {
                if (!textToSpeechReady) {
                    pendingSpeech = clean
                    return@runOnUiThread
                }
                speakNow(clean)
            }
        }

        @JavascriptInterface
        fun stopSpeaking() {
            runOnUiThread {
                pendingSpeech = null
                textToSpeech?.stop()
                notifyNativeTts(started = false)
            }
        }

        @JavascriptInterface
        fun prepareForVoiceCapture() {
            runOnUiThread {
                suspendTextToSpeechForCapture()
            }
        }

        @JavascriptInterface
        fun finishVoiceCapture() {
            runOnUiThread {
                resumeTextToSpeechAfterCapture()
            }
        }

        @JavascriptInterface
        fun startVoiceRecording(): String = startNativeVoiceRecorder()

        @JavascriptInterface
        fun stopVoiceRecording(): String =
            stopNativeVoiceRecorder(cancel = false)

        @JavascriptInterface
        fun cancelVoiceRecording(): String =
            stopNativeVoiceRecorder(cancel = true)

        @JavascriptInterface
        fun microphoneState(): String {
            val granted =
                checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
            return "permission=" +
                (if (granted) "granted" else "denied") +
                ";ttsReady=" +
                textToSpeechReady +
                ";ttsSuspended=" +
                textToSpeechSuspendedForCapture
        }

        @JavascriptInterface
        fun haptic(milliseconds: Int) {
            val duration = milliseconds.coerceIn(10, 250).toLong()
            val vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createOneShot(
                        duration,
                        VibrationEffect.DEFAULT_AMPLITUDE,
                    ),
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(duration)
            }
        }

        @JavascriptInterface
        fun version(): String = currentVersionName()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val key =
                when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_UP,
                    KeyEvent.KEYCODE_PAGE_UP -> "ArrowUp"

                    KeyEvent.KEYCODE_DPAD_DOWN,
                    KeyEvent.KEYCODE_PAGE_DOWN -> "ArrowDown"

                    else -> null
                }

            if (key != null && ::webView.isInitialized) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new KeyboardEvent('keydown',{key:" +
                        JSONObject.quote(key) +
                        ",bubbles:true}));",
                    null,
                )
                return true
            }
        }

        return super.dispatchKeyEvent(event)
    }

    override fun onResume() {
        super.onResume()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        scheduleImmersiveMode()
        updateManager?.onResume()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) scheduleImmersiveMode()
    }

    private fun scheduleImmersiveMode() {
        val decor = window.decorView
        decor.post {
            if (!decor.isAttachedToWindow) return@post
            enterImmersiveMode(decor)
        }
    }

    @Suppress("DEPRECATION")
    private fun enterImmersiveMode(decor: View) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            decor.windowInsetsController?.apply {
                hide(
                    WindowInsets.Type.statusBars() or
                    WindowInsets.Type.navigationBars(),
                )
                systemBarsBehavior =
                    android.view.WindowInsetsController
                        .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            decor.systemUiVisibility =
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != AUDIO_PERMISSION_REQUEST) return

        val request = pendingWebPermission
        pendingWebPermission = null

        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            request?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            request?.deny()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        voiceRecorder?.release()
        voiceRecorder = null
        voiceRecordingFile?.delete()
        voiceRecordingFile = null
        pendingWebPermission?.deny()
        pendingWebPermission = null
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        updateManager?.shutdown()
        updateManager = null

        if (::webView.isInitialized) {
            webView.removeJavascriptInterface(shellConfig.bridgeName)
            webView.destroy()
        }

        super.onDestroy()
    }
}
