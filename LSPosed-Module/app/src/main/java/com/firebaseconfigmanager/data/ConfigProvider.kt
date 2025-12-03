package com.firebaseconfigmanager.data

import android.content.ContentProvider
import android.content.ContentValues
import android.content.UriMatcher
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri

/**
 * Content Provider for cross-process access to config data.
 * This allows the Xposed hook to read config overrides from the manager app.
 */
class ConfigProvider : ContentProvider() {

    companion object {
        const val AUTHORITY = "com.firebaseconfigmanager.provider"
        val CONTENT_URI: Uri = Uri.parse("content://$AUTHORITY")

        private const val CODE_OVERRIDES = 1
        private const val CODE_DEFAULTS = 2

        private val uriMatcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(AUTHORITY, "overrides", CODE_OVERRIDES)
            addURI(AUTHORITY, "defaults", CODE_DEFAULTS)
        }
    }

    override fun onCreate(): Boolean = true

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor? {
        val context = context ?: return null
        val prefs = ConfigStorage.getPrefs(context)

        return when (uriMatcher.match(uri)) {
            CODE_OVERRIDES -> {
                val cursor = MatrixCursor(arrayOf("name", "value"))
                ConfigStorage.getOverrides(prefs).forEach { (name, value) ->
                    cursor.addRow(arrayOf(name, value))
                }
                cursor
            }
            CODE_DEFAULTS -> {
                val cursor = MatrixCursor(arrayOf("name", "value", "type"))
                ConfigStorage.getDefaults(prefs).forEach { (name, default) ->
                    cursor.addRow(arrayOf(name, default.value, default.type.name))
                }
                cursor
            }
            else -> null
        }
    }

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        val context = context ?: return null
        val prefs = ConfigStorage.getPrefs(context)

        when (uriMatcher.match(uri)) {
            CODE_OVERRIDES -> {
                val name = values?.getAsString("name") ?: return null
                val value = values.getAsString("value")
                ConfigStorage.saveOverride(prefs, name, value)
            }
            CODE_DEFAULTS -> {
                val name = values?.getAsString("name") ?: return null
                val value = values.getAsString("value") ?: return null
                val typeStr = values.getAsString("type") ?: "STRING"
                val type = try {
                    ConfigType.valueOf(typeStr)
                } catch (e: Exception) {
                    ConfigType.STRING
                }
                ConfigStorage.saveDefault(prefs, name, value, type)
            }
        }

        context.contentResolver.notifyChange(uri, null)
        return uri
    }

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int {
        val context = context ?: return 0
        val prefs = ConfigStorage.getPrefs(context)

        when (uriMatcher.match(uri)) {
            CODE_OVERRIDES -> {
                if (selection == "clear_all") {
                    ConfigStorage.clearAllOverrides(prefs)
                } else if (selection != null) {
                    ConfigStorage.saveOverride(prefs, selection, null)
                }
            }
        }

        context.contentResolver.notifyChange(uri, null)
        return 1
    }

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int = 0
}
