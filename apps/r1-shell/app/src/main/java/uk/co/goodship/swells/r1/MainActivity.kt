package uk.co.goodship.swells.r1

import uk.co.goodship.device.r1.GoodShipR1Activity
import uk.co.goodship.device.r1.ReleaseUpdateConfig
import uk.co.goodship.device.r1.ShellConfig

class MainActivity : GoodShipR1Activity() {
    override val shellConfig = ShellConfig(
        productName = "Swells",
        initialUrl = "https://swells.app/r1",
        trustedHosts = setOf("swells.app", "www.swells.app"),
        signInPath = "/sign-in",
        authSuccessPathPrefix = "/dashboard",
        bridgeName = "SwellsDevice",
        datasetKey = "swellsShell",
        eventPrefix = "swells",
        userAgentProduct = "SwellsR1Shell",
        update = ReleaseUpdateConfig(
            releaseApiUrl = "https://api.github.com/repos/tomcwxyz/undercurrent/releases/tags/swells-r1-alpha",
            preferenceKey = "swells-r1-updates",
        ),
        backgroundRed = 10,
        backgroundGreen = 14,
        backgroundBlue = 26,
    )
}
