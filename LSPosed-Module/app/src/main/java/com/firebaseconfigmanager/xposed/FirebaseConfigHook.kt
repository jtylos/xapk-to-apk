package com.firebaseconfigmanager.xposed

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import de.robv.android.xposed.IXposedHookLoadPackage
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedBridge
import de.robv.android.xposed.XposedHelpers
import de.robv.android.xposed.callbacks.XC_LoadPackage

/**
 * LSPosed/Xposed hook for Firebase Feature Toggle and Remote Config interception.
 * 
 * Based on the Frida script firebaseFeatureConfigScript.js
 * 
 * This hook:
 * 1. Intercepts all Firebase config/toggle requests
 * 2. Logs and stores default values
 * 3. Applies user-defined overrides from the manager app
 */
class FirebaseConfigHook : IXposedHookLoadPackage {

    companion object {
        private const val TAG = "FirebaseConfigHook"
        private const val TARGET_PACKAGE = "com.takeaway.driver"
        private const val PROVIDER_AUTHORITY = "com.firebaseconfigmanager.provider"
        
        // Classes to hook
        private const val FIREBASE_TOGGLE_SERVICE = "com.takeaway.driver.commons.config.FirebaseFeatureToggleService"
        private const val REMOTE_TOGGLE = "com.takeaway.driver.commons.config.RemoteToggle"
        private const val REMOTE_CONFIG = "com.takeaway.driver.commons.config.RemoteConfig"
        private const val FIREBASE_REMOTE_CONFIG = "com.google.firebase.remoteconfig.a"
    }

    private var appContext: Context? = null
    private val overridesCache = mutableMapOf<String, String>()
    private var cacheLoaded = false

    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        if (lpparam.packageName != TARGET_PACKAGE) return

        XposedBridge.log("[$TAG] Hooking into $TARGET_PACKAGE")

        // Hook Application.onCreate to get context
        hookApplicationContext(lpparam)

        // Hook FirebaseFeatureToggleService.fetch
        hookFetch(lpparam)

        // Hook getToggleValue for boolean toggles
        hookGetToggleValue(lpparam)

        // Hook getConfigValue for string/float/int configs
        hookGetConfigValue(lpparam)

        // Hook raw Firebase RemoteConfig methods
        hookFirebaseRemoteConfig(lpparam)

        XposedBridge.log("[$TAG] All hooks installed successfully")
    }

    private fun hookApplicationContext(lpparam: XC_LoadPackage.LoadPackageParam) {
        try {
            val applicationClass = XposedHelpers.findClass("android.app.Application", lpparam.classLoader)
            XposedHelpers.findAndHookMethod(
                applicationClass,
                "onCreate",
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        appContext = param.thisObject as Context
                        XposedBridge.log("[$TAG] Got application context")
                        loadOverridesFromProvider()
                    }
                }
            )
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to hook Application.onCreate: ${e.message}")
        }
    }

    private fun loadOverridesFromProvider() {
        try {
            val context = appContext ?: return
            val uri = Uri.parse("content://$PROVIDER_AUTHORITY/overrides")
            
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                overridesCache.clear()
                val nameIndex = cursor.getColumnIndex("name")
                val valueIndex = cursor.getColumnIndex("value")
                
                while (cursor.moveToNext()) {
                    val name = cursor.getString(nameIndex)
                    val value = cursor.getString(valueIndex)
                    overridesCache[name] = value
                }
                cacheLoaded = true
                XposedBridge.log("[$TAG] Loaded ${overridesCache.size} overrides from provider")
            }
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to load overrides: ${e.message}")
        }
    }

    private fun saveDefaultToProvider(name: String, value: String, type: String) {
        try {
            val context = appContext ?: return
            val uri = Uri.parse("content://$PROVIDER_AUTHORITY/defaults")
            
            val values = ContentValues().apply {
                put("name", name)
                put("value", value)
                put("type", type)
            }
            
            context.contentResolver.insert(uri, values)
            XposedBridge.log("[$TAG] Saved default: $name = $value ($type)")
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to save default: ${e.message}")
        }
    }

    private fun hookFetch(lpparam: XC_LoadPackage.LoadPackageParam) {
        try {
            XposedHelpers.findAndHookMethod(
                FIREBASE_TOGGLE_SERVICE,
                lpparam.classLoader,
                "fetch",
                object : XC_MethodHook() {
                    override fun beforeHookedMethod(param: MethodHookParam) {
                        XposedBridge.log("[$TAG] FirebaseFeatureToggleService.fetch() called")
                        // Reload overrides when fetch is called
                        loadOverridesFromProvider()
                    }
                }
            )
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to hook fetch: ${e.message}")
        }
    }

    private fun hookGetToggleValue(lpparam: XC_LoadPackage.LoadPackageParam) {
        try {
            val remoteToggleClass = XposedHelpers.findClass(REMOTE_TOGGLE, lpparam.classLoader)
            
            XposedHelpers.findAndHookMethod(
                FIREBASE_TOGGLE_SERVICE,
                lpparam.classLoader,
                "getToggleValue",
                remoteToggleClass,
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val toggle = param.args[0]
                        val toggleName = XposedHelpers.callMethod(toggle, "getToggleName") as String
                        val originalValue = param.result as Boolean

                        // Save default value
                        saveDefaultToProvider(toggleName, originalValue.toString(), "BOOLEAN")

                        // Check for override
                        val override = overridesCache[toggleName]
                        if (override != null) {
                            val overrideValue = override.toBoolean()
                            param.result = overrideValue
                            XposedBridge.log("[$TAG] MODIFIED TOGGLE: '$toggleName' Original: $originalValue -> Override: $overrideValue")
                        } else {
                            XposedBridge.log("[$TAG] TOGGLE: '$toggleName' = $originalValue")
                        }
                    }
                }
            )
            XposedBridge.log("[$TAG] Hooked getToggleValue")
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to hook getToggleValue: ${e.message}")
        }
    }

    private fun hookGetConfigValue(lpparam: XC_LoadPackage.LoadPackageParam) {
        try {
            val remoteConfigClass = XposedHelpers.findClass(REMOTE_CONFIG, lpparam.classLoader)
            
            XposedHelpers.findAndHookMethod(
                FIREBASE_TOGGLE_SERVICE,
                lpparam.classLoader,
                "getConfigValue",
                remoteConfigClass,
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val config = param.args[0]
                        val configName = XposedHelpers.callMethod(config, "getConfigName") as String
                        val originalValue = param.result as String

                        // Save default value
                        saveDefaultToProvider(configName, originalValue, "STRING")

                        // Check for override
                        val override = overridesCache[configName]
                        if (override != null) {
                            param.result = override
                            XposedBridge.log("[$TAG] MODIFIED CONFIG: '$configName' Original: '$originalValue' -> Override: '$override'")
                        } else {
                            XposedBridge.log("[$TAG] CONFIG: '$configName' = '$originalValue'")
                        }
                    }
                }
            )
            XposedBridge.log("[$TAG] Hooked getConfigValue")
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to hook getConfigValue: ${e.message}")
        }
    }

    private fun hookFirebaseRemoteConfig(lpparam: XC_LoadPackage.LoadPackageParam) {
        // Hook getString (method 'q' in obfuscated code)
        try {
            XposedHelpers.findAndHookMethod(
                FIREBASE_REMOTE_CONFIG,
                lpparam.classLoader,
                "q",
                String::class.java,
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val key = param.args[0] as String
                        val value = param.result as String
                        XposedBridge.log("[$TAG] FirebaseRemoteConfig.getString: Key='$key' Value='$value'")
                    }
                }
            )
            XposedBridge.log("[$TAG] Hooked FirebaseRemoteConfig.q (getString)")
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to hook FirebaseRemoteConfig.q: ${e.message}")
        }

        // Hook getKeysByPrefix (method 'o' in obfuscated code)
        try {
            XposedHelpers.findAndHookMethod(
                FIREBASE_REMOTE_CONFIG,
                lpparam.classLoader,
                "o",
                String::class.java,
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val prefix = param.args[0] as String
                        val keys = param.result
                        XposedBridge.log("[$TAG] FirebaseRemoteConfig.getKeysByPrefix: Prefix='$prefix' Keys=$keys")
                    }
                }
            )
            XposedBridge.log("[$TAG] Hooked FirebaseRemoteConfig.o (getKeysByPrefix)")
        } catch (e: Exception) {
            XposedBridge.log("[$TAG] Failed to hook FirebaseRemoteConfig.o: ${e.message}")
        }
    }
}
