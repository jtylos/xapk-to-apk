package com.example.scooberflags;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashMap;
import java.util.Map;

import de.robv.android.xposed.IXposedHookLoadPackage;
import de.robv.android.xposed.XC_MethodHook;
import de.robv.android.xposed.XSharedPreferences;
import de.robv.android.xposed.XposedBridge;
import de.robv.android.xposed.XposedHelpers;
import de.robv.android.xposed.callbacks.XC_LoadPackage;

public class FeatureFlagHook implements IXposedHookLoadPackage {

    private static final String TARGET_PACKAGE = "com.takeaway.driver";
    private static final String PREFS_FILE = "scoober_feature_flags";
    private static final String BOOLEAN_FLAGS_KEY = "boolean_flags";
    private static final String STRING_FLAGS_KEY = "string_flags";

    // Default values for boolean toggles (same as in the Frida script)
    private final Map<String, Boolean> defaultBooleanToggles = new HashMap<String, Boolean>() {{
        put("shift_planning_monthly_statistics_enabled", true);
        put("shift_planning_statistics_enabled", true);
        put("new_analytics_setting_enabled", true);
        put("tipped_data_enabled", true);
        put("bonus_enabled", true);
        put("in_app_navigation_enabled", false);
        put("chat_enabled", true);
        put("courier_contact_reasons_enabled", true);
    }};

    // Default values for string/float configs
    private final Map<String, String> defaultConfigs = new HashMap<String, String>() {{
        // Add default string configs here if needed
    }};

    @Override
    public void handleLoadPackage(XC_LoadPackage.LoadPackageParam lpparam) throws Throwable {
        if (!lpparam.packageName.equals(TARGET_PACKAGE)) {
            return;
        }

        XposedBridge.log("[ScooberFlags] Starting hook for Firebase Feature Flags modification...");

        // Load saved preferences
        XSharedPreferences savedPrefs = new XSharedPreferences("com.example.scooberflags", PREFS_FILE);
        savedPrefs.makeWorldReadable();
        
        // Hook into FirebaseFeatureToggleService
        hookFirebaseFeatureToggle(lpparam, savedPrefs);
    }

    private void hookFirebaseFeatureToggle(XC_LoadPackage.LoadPackageParam lpparam, XSharedPreferences prefs) {
        try {
            // Get classes
            final Class<?> firebaseFeatureToggleServiceClass = XposedHelpers.findClass(
                    "com.takeaway.driver.commons.config.FirebaseFeatureToggleService", 
                    lpparam.classLoader);

            // Hook getToggleValue method (for boolean toggles)
            XposedHelpers.findAndHookMethod(
                    firebaseFeatureToggleServiceClass,
                    "getToggleValue",
                    "com.takeaway.driver.commons.config.RemoteToggle",
                    new XC_MethodHook() {
                        @Override
                        protected void beforeHookedMethod(MethodHookParam param) throws Throwable {
                            Object toggle = param.args[0];
                            String toggleName = (String) XposedHelpers.callMethod(toggle, "getToggleName");

                            // Check if we have a user-set value in preferences
                            Map<String, Boolean> booleanToggles = loadBooleanFlags(prefs);
                            if (booleanToggles.containsKey(toggleName)) {
                                Boolean newValue = booleanToggles.get(toggleName);
                                XposedBridge.log("[ScooberFlags] MODIFIED TOGGLE: '" + toggleName + "' FORCING TO: " + newValue);
                                param.setResult(newValue);
                            } else {
                                XposedBridge.log("[ScooberFlags] TOGGLE: '" + toggleName + "' using original value");
                            }
                        }
                    }
            );

            // Hook getConfigValue method (for string/float/int configs)
            XposedHelpers.findAndHookMethod(
                    firebaseFeatureToggleServiceClass,
                    "getConfigValue",
                    "com.takeaway.driver.commons.config.RemoteConfig",
                    new XC_MethodHook() {
                        @Override
                        protected void beforeHookedMethod(MethodHookParam param) throws Throwable {
                            Object config = param.args[0];
                            String configName = (String) XposedHelpers.callMethod(config, "getConfigName");

                            // Check if we have a user-set value in preferences
                            Map<String, String> stringConfigs = loadStringFlags(prefs);
                            if (stringConfigs.containsKey(configName)) {
                                String newValue = stringConfigs.get(configName);
                                XposedBridge.log("[ScooberFlags] MODIFIED CONFIG: '" + configName + "' FORCING TO: '" + newValue + "'");
                                param.setResult(newValue);
                            } else {
                                XposedBridge.log("[ScooberFlags] CONFIG: '" + configName + "' using original value");
                            }
                        }
                    }
            );

            // Optional - Hook Firebase Remote Config directly for logging
            try {
                XposedHelpers.findAndHookMethod(
                        "com.google.firebase.remoteconfig.a", 
                        lpparam.classLoader,
                        "q", 
                        String.class,
                        new XC_MethodHook() {
                            @Override
                            protected void afterHookedMethod(MethodHookParam param) throws Throwable {
                                String key = (String) param.args[0];
                                String value = (String) param.getResult();
                                XposedBridge.log("[ScooberFlags] Raw Firebase Config: Key='" + key + "' Value='" + value + "'");
                            }
                        }
                );
            } catch (Exception e) {
                XposedBridge.log("[ScooberFlags] Failed to hook Firebase Remote Config: " + e.getMessage());
            }

            XposedBridge.log("[ScooberFlags] Hook installed successfully!");
        } catch (Exception e) {
            XposedBridge.log("[ScooberFlags] Error hooking methods: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // Helper methods to load flags from preferences
    private Map<String, Boolean> loadBooleanFlags(XSharedPreferences prefs) {
        Map<String, Boolean> result = new HashMap<>(defaultBooleanToggles);
        Map<String, ?> allPrefs = prefs.getAll();
        
        // Load saved boolean flags 
        for (String key : allPrefs.keySet()) {
            if (key.startsWith(BOOLEAN_FLAGS_KEY + "_")) {
                String flagName = key.substring((BOOLEAN_FLAGS_KEY + "_").length());
                result.put(flagName, prefs.getBoolean(key, false));
            }
        }
        
        return result;
    }

    private Map<String, String> loadStringFlags(XSharedPreferences prefs) {
        Map<String, String> result = new HashMap<>(defaultConfigs);
        Map<String, ?> allPrefs = prefs.getAll();
        
        // Load saved string flags
        for (String key : allPrefs.keySet()) {
            if (key.startsWith(STRING_FLAGS_KEY + "_")) {
                String flagName = key.substring((STRING_FLAGS_KEY + "_").length());
                result.put(flagName, prefs.getString(key, ""));
            }
        }
        
        return result;
    }
}