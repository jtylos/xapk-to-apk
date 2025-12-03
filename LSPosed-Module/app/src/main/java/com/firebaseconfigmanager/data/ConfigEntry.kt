package com.firebaseconfigmanager.data

/**
 * Represents a Firebase config entry (either toggle or config value)
 */
data class ConfigEntry(
    val name: String,
    val type: ConfigType,
    val defaultValue: String,
    val currentValue: String,
    val isOverridden: Boolean = false
)

enum class ConfigType {
    BOOLEAN,
    STRING,
    FLOAT,
    INT
}
