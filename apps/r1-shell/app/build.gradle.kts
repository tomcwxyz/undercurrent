plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "uk.co.goodship.swells.r1"
    compileSdk = 35

    defaultConfig {
        applicationId = "uk.co.goodship.swells.r1"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.1.1"
    }

    signingConfigs {
        create("swellsDebug") {
            storeFile = file("../debug-signing/swells-r1-debug.keystore")
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
