package uk.co.goodship.device.r1

data class ShellConfig(
    val productName: String,
    val initialUrl: String,
    val trustedHosts: Set<String>,
    val signInPath: String,
    val authSuccessPathPrefix: String,
    val bridgeName: String,
    val datasetKey: String,
    val eventPrefix: String,
    val userAgentProduct: String,
    val update: ReleaseUpdateConfig? = null,
    val backgroundRed: Int,
    val backgroundGreen: Int,
    val backgroundBlue: Int,
)
