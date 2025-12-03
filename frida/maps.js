/*
 * Frida script to bypass Google Maps SDK authorization errors and exchange the API key
 * in Android applications. This script targets the 'com.takeaway.driver' application.
 *
 * It attempts to:
 * 1. Hook and force 'MapsInitializer.initialize' to return success (0).
 * 2. Hook and force 'GooglePlayServicesUtil.isGooglePlayServicesAvailable' to return success (0).
 * 3. Intercept the retrieval of ApplicationInfo to inject a custom Google Maps API key
 * into the metaData bundle, effectively changing the key the app uses at runtime.
 *
 * This can help in scenarios where the API key is restricted by certificate fingerprint
 * or package name, especially on rooted devices or when debugging, and also allows
 * testing with a different API key.
 *
 * This version of the script waits for the application's main Application.onCreate()
 * to be called before attempting to hook the Google Play Services classes and the
 * PackageManager, which helps resolve ClassNotFoundException errors.
 */

// Define your NEW API key here.
// Replace "YOUR_NEW_GOOGLE_MAPS_API_KEY_HERE" with the actual API key you want to use.
const NEW_MAPS_API_KEY = "";

// Define common meta-data names for Google Maps API keys.
// The primary one is "com.google.android.geo.API_KEY".
// Include others if the app might use a different name for some reason.
const MAPS_API_KEY_META_DATA_NAMES = [
    "com.google.android.geo.API_KEY",
    "com.google.android.maps.v2.API_KEY" // Older versions might use this
];

// Wait for the Java environment to be ready.
Java.perform(function() {
    console.log("[Frida] Attaching to com.takeaway.driver process...");

    // Get a reference to the Android Application class.
    var Application = Java.use("android.app.Application");

    // Hook the 'onCreate' method of the Application class.
    Application.onCreate.implementation = function() {
        console.log("[Frida] Application.onCreate() called. Attempting to hook GMS and PackageManager classes...");

        // Call the original onCreate method first to ensure the application initializes properly.
        this.onCreate();

        // --- Hooking PackageManager.getApplicationInfo ---
        // This is where apps typically retrieve meta-data from AndroidManifest.xml.
        try {
            var PackageManager = Java.use("android.app.ApplicationPackageManager");

            // Define the overload for getApplicationInfo that takes packageName and flags.
            // There might be multiple overloads, ensure you target the correct one.
            // Common flags include PackageManager.GET_META_DATA.
            PackageManager.getApplicationInfo.overload("java.lang.String", "int").implementation = function(packageName, flags) {
                // Call the original method to get the legitimate ApplicationInfo.
                var appInfo = this.getApplicationInfo(packageName, flags);

                // Check if the package name matches our target application.
                if (packageName === "com.takeaway.driver") {
                    console.log("[Frida] Intercepted getApplicationInfo for: " + packageName);

                    // Ensure metaData bundle exists and GET_META_DATA flag was requested.
                    // The flags parameter usually contains PackageManager.GET_META_DATA (128)
                    // when an app is trying to retrieve meta-data from the manifest.
                    // IMPORTANT: Access the 'value' property of the Java.Field for the actual Bundle.
                    if (appInfo && appInfo.metaData && appInfo.metaData.value && (flags & 128) !== 0) {
                        const metaDataBundle = appInfo.metaData.value;
                        console.log("[Frida] Original metaData bundle: " + metaDataBundle);

                        // Iterate through common API key names and replace the value.
                        let keyReplaced = false;
                        for (let i = 0; i < MAPS_API_KEY_META_DATA_NAMES.length; i++) {
                            const metaDataName = MAPS_API_KEY_META_DATA_NAMES[i];
                            // Use containsKey on the actual Bundle
                            if (metaDataBundle.containsKey(metaDataName)) {
                                console.log("[Frida] Found existing Maps API key meta-data: " + metaDataName);
                                // Use getString on the actual Bundle
                                console.log("[Frida] Original API Key: " + metaDataBundle.getString(metaDataName));

                                // Inject the new API key using putString on the actual Bundle.
                                metaDataBundle.putString(metaDataName, NEW_MAPS_API_KEY);
                                console.log("[Frida] Injected new API Key: " + NEW_MAPS_API_KEY + " for " + metaDataName);
                                keyReplaced = true;
                                // If you want to replace only the first found key, uncomment 'break;'.
                                // break;
                            }
                        }

                        // If no existing key was found, but we are looking for meta-data,
                        // consider adding the primary Google Maps API key.
                        if (!keyReplaced && NEW_MAPS_API_KEY !== "YOUR_NEW_GOOGLE_MAPS_API_KEY_HERE") {
                            const primaryKeyName = MAPS_API_KEY_META_DATA_NAMES[0];
                            console.log("[Frida] No existing Maps API key meta-data found, adding primary key: " + primaryKeyName);
                            metaDataBundle.putString(primaryKeyName, NEW_MAPS_API_KEY);
                            console.log("[Frida] Injected new API Key as a new entry: " + NEW_MAPS_API_KEY + " for " + primaryKeyName);
                        }
                    } else {
                        console.log("[Frida] getApplicationInfo called without GET_META_DATA flag or metaData/metaData.value is null, skipping key injection.");
                    }
                }
                return appInfo;
            };
            console.log("[Frida] Successfully hooked PackageManager.getApplicationInfo.");

        } catch (e) {
            console.error("[Frida Error] Failed to hook PackageManager.getApplicationInfo: " + e.message);
        }

        // Now that the application is more fully initialized,
        // attempt to hook the Google Maps SDK classes.
        try {
            // --- Hooking MapsInitializer.initialize ---
            var MapsInitializer = Java.use("com.google.android.gms.maps.MapsInitializer");
            MapsInitializer.initialize.overload("android.content.Context").implementation = function(context) {
                console.log("[Frida] Hooked MapsInitializer.initialize(Context)");
                console.log("[Frida] Original call: MapsInitializer.initialize(" + context + ")");
                var originalReturnValue = this.initialize(context);
                console.log("[Frida] Original MapsInitializer.initialize return value: " + originalReturnValue);
                var forcedReturnValue = 0; // ConnectionResult.SUCCESS
                console.log("[Frida] Forcing MapsInitializer.initialize return to: " + forcedReturnValue);
                return forcedReturnValue;
            };
            console.log("[Frida] Successfully hooked MapsInitializer.initialize.");

        } catch (e) {
            console.error("[Frida Error] Failed to hook MapsInitializer.initialize: " + e.message);
        }

        try {
            // --- Hooking GooglePlayServicesUtil.isGooglePlayServicesAvailable ---
            var GooglePlayServicesUtil = Java.use("com.google.android.gms.common.GooglePlayServicesUtil");
            GooglePlayServicesUtil.isGooglePlayServicesAvailable.overload("android.content.Context").implementation = function(context) {
                console.log("[Frida] Hooked GooglePlayServicesUtil.isGooglePlayServicesAvailable(Context)");
                console.log("[Frida] Original call: GooglePlayServicesUtil.isGooglePlayServicesUtil(" + context + ")");
                var originalReturnValue = this.isGooglePlayServicesAvailable(context);
                console.log("[Frida] Original GooglePlayServicesUtil.isGooglePlayServicesAvailable return value: " + originalReturnValue);
                var forcedReturnValue = 0;
                console.log("[Frida] Forcing GooglePlayServicesUtil.isGooglePlayServicesAvailable return to: " + forcedReturnValue);
                return forcedReturnValue;
            };
            console.log("[Frida] Successfully hooked GooglePlayServicesUtil.isGooglePlayServicesAvailable.");

        } catch (e) {
            console.error("[Frida Error] Failed to hook GooglePlayServicesUtil.isGooglePlayServicesAvailable: " + e.message);
        }
    }; // End of Application.onCreate.implementation

    console.log("[Frida] Script loaded. Waiting for Application.onCreate() to be called...");
});
