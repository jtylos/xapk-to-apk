# Setup and Build Instructions

## Prerequisites

1. **Android Studio**: Download and install from https://developer.android.com/studio
2. **LSPosed Framework**: Your device must have LSPosed installed (requires root or Magisk)
3. **Java Development Kit (JDK)**: Usually bundled with Android Studio

## Project Setup

### Option 1: Using Android Studio (Recommended)

1. Open Android Studio
2. Click "Open an existing project"
3. Navigate to the `LSPosed-Module` folder
4. Wait for Gradle sync to complete
5. If there are any SDK version warnings, accept the suggested updates

### Option 2: Command Line Build

1. Install Android SDK command-line tools
2. Set up ANDROID_HOME environment variable
3. Run from the project directory:
   ```
   ./gradlew assembleDebug
   ```

## Building the APK

### In Android Studio:

1. Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
2. Wait for the build to complete
3. Click "locate" in the notification to find the APK
4. The APK will be at: `app/build/outputs/apk/debug/app-debug.apk`

### Via Command Line:

```bash
cd LSPosed-Module
./gradlew assembleDebug
```

The APK will be in `app/build/outputs/apk/debug/`

## Installation Steps

1. **Transfer the APK** to your Android device
2. **Install the APK** (you may need to enable "Install from unknown sources")
3. **Open LSPosed Manager**
4. Navigate to **Modules** tab
5. Find and **enable** "Scoober Feature Flags"
6. **Tap on the module** to open scope settings
7. **Check** the Scoober/Takeaway Driver app in the scope list
8. **Reboot** your device (or use LSPosed's soft reboot)

## Verifying Installation

1. Open the "Scoober Feature Flags" app
2. You should see the default feature flags listed
3. Open the Scoober app
4. Check LSPosed logs to verify the module is hooking correctly

## Using the Module

1. **Toggle Boolean Flags**: Simply flip the switch next to any flag
2. **Edit String/Float Flags**: Enter the value and tap "Save"
3. **Add Custom Flags**: Use the "Add Boolean Flag" or "Add String/Float Flag" buttons
4. **Reset to Defaults**: Use the "Reset to Defaults" button to revert all changes

## Viewing Logs

To see what the module is doing:

1. Open LSPosed Manager
2. Go to **Logs** tab
3. Enable verbose logging
4. Look for messages starting with `[ScooberFlags]`

## Troubleshooting

### Module Not Working

- Ensure the module is enabled in LSPosed Manager
- Verify the Scoober app is in the module's scope
- Check that you've rebooted after enabling
- Review LSPosed logs for errors

### App Crashes

- Check if class names have changed in a newer version of Scoober
- Look at the crash logs in LSPosed Manager
- Try disabling the module temporarily

### Changes Not Taking Effect

- Make sure to **restart the Scoober app** after changing flags
- Verify the SharedPreferences are being written (check with logcat)
- Confirm the module is actually hooking (check LSPosed logs)

### Build Errors

- Ensure you have the correct SDK versions installed
- Try **File** > **Invalidate Caches / Restart** in Android Studio
- Clean and rebuild: **Build** > **Clean Project** then **Build** > **Rebuild Project**

## Customizing Default Flags

To change which flags are shown by default:

1. Open `FeatureFlagHook.java`
2. Edit the `defaultBooleanToggles` HashMap
3. Open `MainActivity.java`
4. Edit the matching `defaultBooleanToggles` HashMap
5. Rebuild the APK

## Notes

- The module requires world-readable permissions for SharedPreferences
- Some Android versions may restrict this - if flags aren't syncing, check SELinux policies
- Always test on a non-production device first

## Comparison with Frida Script

| Feature | Frida Script | LSPosed Module |
|---------|-------------|----------------|
| Requires PC | Yes | No |
| User Interface | No | Yes |
| Persistent Settings | No | Yes |
| Device Root | No (with frida-server) | Yes (LSPosed) |
| Easy to Modify | Yes (edit .js) | Requires rebuild |