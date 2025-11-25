# Scoober Feature Flags Module for LSPosed

This LSPosed module allows you to modify Firebase feature flags in the Scoober (Takeaway Driver) app on-the-fly.

## Features

- Toggle boolean feature flags directly through a simple UI
- Modify string/float/integer feature flags
- Add custom flags to control additional features
- Reset all flags to default values with a single tap
- Changes persisted across app restarts

## Default Feature Flags (Boolean)

- shift_planning_monthly_statistics_enabled
- shift_planning_statistics_enabled  
- new_analytics_setting_enabled
- tipped_data_enabled
- bonus_enabled
- in_app_navigation_enabled
- chat_enabled
- courier_contact_reasons_enabled

## Building the Module

1. Install Android Studio
2. Open the project folder in Android Studio
3. Build the project using Gradle (Build > Build Bundle(s) / APK(s) > Build APK(s))
4. The APK will be generated in `app/build/outputs/apk/debug/`

## Installation

1. Install LSPosed Framework on your device
2. Install the APK built from this project
3. Open LSPosed Manager app
4. Go to Modules and enable "Scoober Feature Flags"
5. In the same menu, tap on the module and add the Scoober app to the scope
6. Reboot your device (or use the soft reboot option in LSPosed)

## Usage

1. Open the "Scoober Feature Flags" app
2. Toggle boolean flags using the switches
3. Edit string/float values and tap Save
4. Add new custom flags using the "Add" buttons
5. Reset to defaults using the "Reset" button
6. Changes take effect after restarting the Scoober app

## Technical Details

The module hooks into the following classes:
- `com.takeaway.driver.commons.config.FirebaseFeatureToggleService`
- `com.google.firebase.remoteconfig.a`

It intercepts method calls to:
- `getToggleValue` - For boolean flags
- `getConfigValue` - For string/float/integer flags

## Converting from Frida Script

This module is a conversion of the Frida script `firebaseFeatureConfigScript.js` which originally modified the same feature flags at runtime. The advantage of this LSPosed module is that it doesn't require Frida running and provides a user interface to modify the flags.

## License

This software is provided as-is without any warranty. Use at your own risk.