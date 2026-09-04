plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "uk.co.goodship.swells.tablet"
    compileSdk = 35

    defaultConfig {
        applicationId = "uk.co.goodship.swells.tablet"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        create("swellsDebug") {
            storeFile = file("../../r1-shell/debug-signing/swells-r1-debug.keystore")
            storePassword = "swells-r1-debug"
            keyAlias = "swells-r1-debug"
            keyPassword = "swells-r1-debug"
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            signingConfig = signingConfigs.getByName("swellsDebug")
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
