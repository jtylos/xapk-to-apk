/*
 * Frida script to log Firebase feature flags from FirebaseFeatureToggleService.
 *
 * This script hooks into the FirebaseFeatureToggleService to capture the
 * feature flags as they are fetched and processed. It specifically targets
 * the methods that retrieve config and toggle values.
 */

Java.perform(function() {
    console.log("[*] Starting Frida script for Firebase Feature Flags...");

    // Get a reference to the FirebaseFeatureToggleService class
    const FirebaseFeatureToggleService = Java.use("com.takeaway.driver.commons.config.FirebaseFeatureToggleService");

    // Hook into the 'fetch' method to see when the remote config is being fetched
    FirebaseFeatureToggleService.fetch.implementation = function() {
        console.log("\n[+] FirebaseFeatureToggleService.fetch() called. Initiating remote config fetch...");
        // Call the original method to continue the normal execution flow
        this.fetch();
    };

    // Hook into getConfigurationString$lambda$4 to capture individual config values
    // This method is called when the configuration string is built for logging.
    // It directly accesses firebaseRemoteConfig.r(str).h() which is a good place to intercept.
    try {
        const FirebaseFeatureToggleService_getConfigurationString$lambda$4 = Java.use("com.takeaway.driver.commons.config.FirebaseFeatureToggleService");
        FirebaseFeatureToggleService_getConfigurationString$lambda$4.getConfigurationString$lambda$4.implementation = function(serviceInstance, str) {
            let configValue = this.getConfigurationString$lambda$4(serviceInstance, str); // Call original method to get the value
            console.log(`[+] Fetched Config (from getConfigurationString$lambda$4): ${str} = ${configValue}`);
            return configValue;
        };
    } catch (e) {
        console.error("[-] Failed to hook getConfigurationString$lambda$4: " + e.message);
    }


    // Hook into getConfigValue to capture string config values
    try {
        const RemoteConfig = Java.use("com.takeaway.driver.commons.config.RemoteConfig");
        FirebaseFeatureToggleService.getConfigValue.implementation = function(config) {
            const configName = config.getConfigName(); // Get the config name from the RemoteConfig enum
            const value = this.getConfigValue(config); // Call the original method to get the value
            console.log(`[+] Fetched Config Value: ${configName} = ${value}`);
            return value;
        };
    } catch (e) {
        console.error("[-] Failed to hook getConfigValue: " + e.message);
    }

    // Hook into getToggleValue to capture boolean toggle values
    try {
        const RemoteToggle = Java.use("com.takeaway.driver.commons.config.RemoteToggle");
        FirebaseFeatureToggleService.getToggleValue.implementation = function(toggle) {
            const toggleName = toggle.getToggleName(); // Get the toggle name from the RemoteToggle enum
            const value = this.getToggleValue(toggle); // Call the original method to get the value
            console.log(`[+] Fetched Toggle Value: ${toggleName} = ${value}`);
            return value;
        };
    } catch (e) {
        console.error("[-] Failed to hook getToggleValue: " + e.message);
    }

    // Alternative/Complementary approach: Hook directly into FirebaseRemoteConfig methods
    // This can be useful if the app uses FirebaseRemoteConfig directly in other places
    // or if the above hooks miss some edge cases.

    const FirebaseRemoteConfig = Java.use("com.google.firebase.remoteconfig.a"); // This is the obfuscated class name for FirebaseRemoteConfig

    // // Hook to get boolean values
    // try {
    //     FirebaseRemoteConfig.r.overload('java.lang.String').implementation = function(key) {
    //         const configValue = this.r(key); // Call original method
    //         console.log(`[+] FirebaseRemoteConfig.getBoolean (raw): Key='${key}' Result='${configValue.k()}'`);
    //         return configValue;
    //     };
    // } catch (e) {
    //     console.error("[-] Failed to hook FirebaseRemoteConfig.r: " + e.message);
    // }

    // Hook to get string values
    try {
        FirebaseRemoteConfig.q.overload('java.lang.String').implementation = function(key) {
            const configValue = this.q(key); // Call original method
            console.log(`[+] FirebaseRemoteConfig.getString (raw): Key='${key}' Value='${configValue}'`);
            return configValue;
        };
    } catch (e) {
        console.error("[-] Failed to hook FirebaseRemoteConfig.q: " + e.message);
    }

    // Hook to get all keys by prefix
    try {
        FirebaseRemoteConfig.o.overload('java.lang.String').implementation = function(prefix) {
            const keys = this.o(prefix); // Call original method
            console.log(`[+] FirebaseRemoteConfig.getKeysByPrefix: Prefix='${prefix}' Keys=${keys.toString()}`);
            return keys;
        };
    } catch (e) {
        console.error("[-] Failed to hook FirebaseRemoteConfig.o: " + e.message);
    }




    console.log("[*] Frida script loaded successfully. Waiting for feature flag activity...");

    console.log("[*] Starting Frida script to modify Firebase Feature Flags...");

    // Get a reference to the FirebaseFeatureToggleService class
    const RemoteToggle = Java.use("com.takeaway.driver.commons.config.RemoteToggle"); // Need this to access toggle name

    // Target the getToggleValue method to change boolean flags
    FirebaseFeatureToggleService.getToggleValue.implementation = function(toggle) {
        // Call the original method first to get its intended value
        // This is good practice as it keeps the original flow, and then we decide to override.
        let originalValue = this.getToggleValue(toggle);

        // Get the name of the toggle being requested
        const toggleName = toggle.getToggleName();

        // --- Configuration for Modifying Flags ---
        const FLAGS_TO_MODIFY = {
            "shift_resume_working_enabled": true, // Change 'chat_enabled' to true
            "sse_events_datadog_logs_enabled": true,
            "health_status_questioning_enabled ": true,
            "navigation_route_button_with_text": true,
            "new_analytics_setting_enabled": true,
            "shift_planning_monthly_statistics_enabled": true,
            "shift_planning_statistics_enabled": true,
            "tipped_data_enabled": false,
            "job_seen_v2_enabled": true,
            "minimum_working_hours_enabled": true,
            "mock_customer_courier_chat": true,
            "route_polylines_enabled": true,
            "sendbird_ai_agent_enabled": true,
            "shift_overview_clock_on_button_enabled": true,
            "customer_courier_chat_enabled": true,
            "bonus_enabled": true,
            "minimum_working_hours_factor": 1.0,
            "health_status_questioning_enabled": true,
            // Add other boolean flags here if y:ou want to modify them:
            // "another_boolean_flag": false,
            // "some_other_toggle": true
        };
        // --- End Configuration ---

        if (FLAGS_TO_MODIFY.hasOwnProperty(toggleName)) {
            const desiredValue = FLAGS_TO_MODIFY[toggleName];
            console.log(`[+] MODIFIED TOGGLE: '${toggleName}' requested. Original: ${originalValue}, FORCING TO: ${desiredValue}`);
            return desiredValue; // Return the desired, modified value
        } else {
            // For any other toggle not in our list, return its original value
            console.log(`[*] TOGGLE: '${toggleName}' requested. Returning original value: ${originalValue}`);
            return originalValue;
        }
    };
});