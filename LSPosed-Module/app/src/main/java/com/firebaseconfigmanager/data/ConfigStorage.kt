package com.firebaseconfigmanager.data

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Manages persistent storage of Firebase config entries.
 * Uses SharedPreferences with MODE_WORLD_READABLE for cross-process access.
 */
object ConfigStorage {

    private const val PREFS_NAME = "firebase_config_data"
    private const val KEY_CONFIGS = "configs"
    private const val KEY_TOGGLES = "toggles"
    private const val KEY_OVERRIDES = "overrides"
    private const val KEY_DEFAULTS = "defaults"

    private val gson = Gson()

    /**
     * Get SharedPreferences with world-readable mode for Xposed access
     */
    @Suppress("DEPRECATION")
    fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_WORLD_READABLE)
    }

    /**
     * Save a discovered config with its default value
     */
    fun saveDefault(prefs: SharedPreferences, name: String, value: String, type: ConfigType) {
        val defaults = getDefaults(prefs).toMutableMap()
        if (!defaults.containsKey(name)) {
            defaults[name] = ConfigDefault(value, type)
            prefs.edit().putString(KEY_DEFAULTS, gson.toJson(defaults)).apply()
        }
    }

    /**
     * Get all default values
     */
    fun getDefaults(prefs: SharedPreferences): Map<String, ConfigDefault> {
        val json = prefs.getString(KEY_DEFAULTS, "{}") ?: "{}"
        val type = object : TypeToken<Map<String, ConfigDefault>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
    }

    /**
     * Save an override value
     */
    fun saveOverride(prefs: SharedPreferences, name: String, value: String?) {
        val overrides = getOverrides(prefs).toMutableMap()
        if (value != null) {
            overrides[name] = value
        } else {
            overrides.remove(name)
        }
        prefs.edit().putString(KEY_OVERRIDES, gson.toJson(overrides)).apply()
    }

    /**
     * Get all override values
     */
    fun getOverrides(prefs: SharedPreferences): Map<String, String> {
        val json = prefs.getString(KEY_OVERRIDES, "{}") ?: "{}"
        val type = object : TypeToken<Map<String, String>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
    }

    /**
     * Check if a config has an override
     */
    fun hasOverride(prefs: SharedPreferences, name: String): Boolean {
        return getOverrides(prefs).containsKey(name)
    }

    /**
     * Get override value if exists
     */
    fun getOverride(prefs: SharedPreferences, name: String): String? {
        return getOverrides(prefs)[name]
    }

    /**
     * Get all config entries (defaults + overrides combined)
     */
    fun getAllConfigs(prefs: SharedPreferences): List<ConfigEntry> {
        val defaults = getDefaults(prefs)
        val overrides = getOverrides(prefs)

        return defaults.map { (name, default) ->
            val override = overrides[name]
            ConfigEntry(
                name = name,
                type = default.type,
                defaultValue = default.value,
                currentValue = override ?: default.value,
                isOverridden = override != null
            )
        }.sortedBy { it.name }
    }

    /**
     * Clear all overrides
     */
    fun clearAllOverrides(prefs: SharedPreferences) {
        prefs.edit().putString(KEY_OVERRIDES, "{}").apply()
    }

    /**
     * Clear all data
     */
    fun clearAll(prefs: SharedPreferences) {
        prefs.edit().clear().apply()
    }

    data class ConfigDefault(
        val value: String,
        val type: ConfigType
    )
}
