package uk.co.goodship.device.r1

data class ReleaseUpdateConfig(
    val releaseApiUrl: String,
    val preferenceKey: String,
    val checkIntervalMs: Long = 15L * 60L * 1000L,
    val maxApkBytes: Long = 8L * 1024L * 1024L,
)
