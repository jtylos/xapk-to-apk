/*
 * Frida script to log and modify Firebase feature flags.
 *
 * This script hooks into FirebaseFeatureToggleService methods to
 * capture and override feature flag values based on their type (boolean, string/float).
 */

Java.perform(function() {
    console.log("[*] Starting Frida script for Firebase Feature Flags modification...");

    // Get a reference to the FirebaseFeatureToggleService class
    const FirebaseFeatureToggleService = Java.use("com.takeaway.driver.commons.config.FirebaseFeatureToggleService");
    const RemoteToggle = Java.use("com.takeaway.driver.commons.config.RemoteToggle");
    const RemoteConfig = Java.use("com.takeaway.driver.commons.config.RemoteConfig"); // Need this for getConfigValue

    // --- Configuration for Modifying Boolean Toggles ---
    const BOOLEAN_TOGGLES_TO_MODIFY = {
        "shift_planning_monthly_statistics_enabled": true,
        "shift_planning_statistics_enabled": true,
        "new_analytics_setting_enabled": true,
        "tipped_data_enabled": true,
        "bonus_enabled": true,
        "in_app_navigation_enabled": false,
        "chat_enabled": true,
        "courier_contact_reasons_enabled": true

    };
    // --- End Boolean Toggle Configuration ---

    // --- Configuration for Modifying String/Float/Other Configs ---
    // Note: Floats/Doubles in Java are often represented as Strings in Firebase Remote Config
    // or as actual numerical types. We will treat them as strings for getConfigValue.
    const CONFIGS_TO_MODIFY = {
        "minimum_working_hours_factor": "1.0", // Return as a String for getConfigValue!
        // Add other string/float/int configs here, e.g.:
        // "delivery_fee_multiplier": "1.25",
        // "api_endpoint_url": "https://new.api.example.com"
    };
    // --- End Configs Configuration ---


    // Hook into the 'fetch' method for logging fetch events
    FirebaseFeatureToggleService.fetch.implementation = function() {
        console.log("\n[+] FirebaseFeatureToggleService.fetch() called. Initiating remote config fetch...");
        this.fetch();
    };

    // Hook into getConfigurationString$lambda$4 for general logging of configs
    try {
        // Note: You defined FirebaseFeatureToggleService twice in your original script.
        // I'm using the first definition which is correct.
        FirebaseFeatureToggleService.getConfigurationString$lambda$4.implementation = function(serviceInstance, str) {
            let configValue = this.getConfigurationString$lambda$4(serviceInstance, str);
            console.log(`[+] Fetched Config (from getConfigurationString$lambda$4): ${str} = ${configValue}`);
            return configValue;
        };
    } catch (e) {
        console.error("[-] Failed to hook getConfigurationString$lambda$4: " + e.message);
    }

    // Hook into getConfigValue to modify and capture STRING/FLOAT/INT configs
    FirebaseFeatureToggleService.getConfigValue.implementation = function(config) {
        const configName = config.getConfigName();
        let originalValue = this.getConfigValue(config); // Get original value first

        if (CONFIGS_TO_MODIFY.hasOwnProperty(configName)) {
            const desiredValue = CONFIGS_TO_MODIFY[configName];
            console.log(`[+] MODIFIED CONFIG: '${configName}' requested. Original: '${originalValue}', FORCING TO: '${desiredValue}'`);
            return desiredValue; // Return the desired, modified string value
        } else {
            console.log(`[*] CONFIG: '${configName}' requested. Returning original value: '${originalValue}'`);
            return originalValue;
        }
    };

    // Hook into getToggleValue to modify and capture BOOLEAN toggles
    FirebaseFeatureToggleService.getToggleValue.implementation = function(toggle) {
        const toggleName = toggle.getToggleName();
        let originalValue = this.getToggleValue(toggle); // Get original value first

        if (BOOLEAN_TOGGLES_TO_MODIFY.hasOwnProperty(toggleName)) {
            const desiredValue = BOOLEAN_TOGGLES_TO_MODIFY[toggleName];
            console.log(`[+] MODIFIED TOGGLE: '${toggleName}' requested. Original: ${originalValue}, FORCING TO: ${desiredValue}`);
            return desiredValue; // Return the desired, modified boolean value
        } else {
            console.log(`[*] TOGGLE: '${toggleName}' requested. Returning original value: ${originalValue}`);
            return originalValue;
        }
    };

    // (Optional) Keep the FirebaseRemoteConfig.q (getString) hook if you want to capture raw string values from Firebase, as that one didn't crash before.
    const FirebaseRemoteConfig = Java.use("com.google.firebase.remoteconfig.a");
    try {
        FirebaseRemoteConfig.q.overload('java.lang.String').implementation = function(key) {
            const configValue = this.q(key);
            console.log(`[+] FirebaseRemoteConfig.getString (raw): Key='${key}' Value='${configValue}'`);
            return configValue;
        };
    } catch (e) {
        console.error("[-] Failed to hook FirebaseRemoteConfig.q: " + e.message);
    }

    // (Optional) Hook to get all keys by prefix if needed for general insights
    try {
        FirebaseRemoteConfig.o.overload('java.lang.String').implementation = function(prefix) {
            const keys = this.o(prefix);
            console.log(`[+] FirebaseRemoteConfig.getKeysByPrefix: Prefix='${prefix}' Keys=${keys.toString()}`);
            return keys;
        };
    } catch (e) {
        console.error("[-] Failed to hook FirebaseRemoteConfig.o: " + e.message);
    }


    console.log("[*] Frida script loaded successfully. Waiting for feature flag activity...");
});