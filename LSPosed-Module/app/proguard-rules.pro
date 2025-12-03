# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.

# Keep Xposed hook class
-keep class com.firebaseconfigmanager.xposed.** { *; }

# Keep config data classes
-keep class com.firebaseconfigmanager.data.** { *; }
