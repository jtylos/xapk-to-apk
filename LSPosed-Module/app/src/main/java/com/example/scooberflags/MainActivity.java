package com.example.scooberflags;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS_FILE = "scoober_feature_flags";
    private static final String BOOLEAN_FLAGS_KEY = "boolean_flags";
    private static final String STRING_FLAGS_KEY = "string_flags";

    // Default boolean feature flags (same as in your Frida script)
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

    // Default string/float feature configs (empty in your Frida script)
    private final Map<String, String> defaultConfigs = new HashMap<String, String>() {{
        // Empty as in your script, but you can add default values here
    }};

    private SharedPreferences prefs;
    private LinearLayout booleanFlagsContainer;
    private LinearLayout stringFlagsContainer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREFS_FILE, Context.MODE_WORLD_READABLE);
        booleanFlagsContainer = findViewById(R.id.boolean_flags_container);
        stringFlagsContainer = findViewById(R.id.string_flags_container);

        Button addBooleanButton = findViewById(R.id.add_boolean_flag);
        Button addStringButton = findViewById(R.id.add_string_flag);
        Button resetButton = findViewById(R.id.reset_button);

        addBooleanButton.setOnClickListener(v -> showAddBooleanFlagDialog());
        addStringButton.setOnClickListener(v -> showAddStringFlagDialog());
        resetButton.setOnClickListener(v -> resetToDefaults());

        loadBooleanFlags();
        loadStringFlags();
    }

    private void loadBooleanFlags() {
        booleanFlagsContainer.removeAllViews();
        
        // First add default flags
        for (Map.Entry<String, Boolean> entry : defaultBooleanToggles.entrySet()) {
            String key = entry.getKey();
            boolean defaultValue = entry.getValue();
            boolean currentValue = prefs.getBoolean(BOOLEAN_FLAGS_KEY + "_" + key, defaultValue);
            
            addBooleanFlagView(key, currentValue);
        }
        
        // Then add custom flags from preferences
        Map<String, ?> allPrefs = prefs.getAll();
        for (String key : allPrefs.keySet()) {
            if (key.startsWith(BOOLEAN_FLAGS_KEY + "_")) {
                String flagName = key.substring((BOOLEAN_FLAGS_KEY + "_").length());
                if (!defaultBooleanToggles.containsKey(flagName)) {
                    boolean value = prefs.getBoolean(key, false);
                    addBooleanFlagView(flagName, value);
                }
            }
        }
    }

    private void loadStringFlags() {
        stringFlagsContainer.removeAllViews();
        
        // First add default configs
        for (Map.Entry<String, String> entry : defaultConfigs.entrySet()) {
            String key = entry.getKey();
            String defaultValue = entry.getValue();
            String currentValue = prefs.getString(STRING_FLAGS_KEY + "_" + key, defaultValue);
            
            addStringFlagView(key, currentValue);
        }
        
        // Then add custom configs from preferences
        Map<String, ?> allPrefs = prefs.getAll();
        for (String key : allPrefs.keySet()) {
            if (key.startsWith(STRING_FLAGS_KEY + "_")) {
                String flagName = key.substring((STRING_FLAGS_KEY + "_").length());
                if (!defaultConfigs.containsKey(flagName)) {
                    String value = prefs.getString(key, "");
                    addStringFlagView(flagName, value);
                }
            }
        }
    }

    private void addBooleanFlagView(String flagName, boolean value) {
        View view = LayoutInflater.from(this).inflate(R.layout.boolean_flag_item, booleanFlagsContainer, false);
        
        TextView nameText = view.findViewById(R.id.flag_name);
        Switch toggleSwitch = view.findViewById(R.id.flag_toggle);
        Button deleteBtn = view.findViewById(R.id.delete_button);
        
        nameText.setText(flagName);
        toggleSwitch.setChecked(value);
        toggleSwitch.setOnCheckedChangeListener((buttonView, isChecked) -> {
            SharedPreferences.Editor editor = prefs.edit();
            editor.putBoolean(BOOLEAN_FLAGS_KEY + "_" + flagName, isChecked);
            editor.apply();
            Toast.makeText(MainActivity.this, "Saved: " + flagName + " = " + isChecked, Toast.LENGTH_SHORT).show();
        });
        
        deleteBtn.setOnClickListener(v -> {
            // Don't allow deleting default flags
            if (defaultBooleanToggles.containsKey(flagName)) {
                Toast.makeText(MainActivity.this, "Cannot delete default flag", Toast.LENGTH_SHORT).show();
                return;
            }
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.remove(BOOLEAN_FLAGS_KEY + "_" + flagName);
            editor.apply();
            booleanFlagsContainer.removeView(view);
            Toast.makeText(MainActivity.this, "Deleted: " + flagName, Toast.LENGTH_SHORT).show();
        });
        
        booleanFlagsContainer.addView(view);
    }

    private void addStringFlagView(String flagName, String value) {
        View view = LayoutInflater.from(this).inflate(R.layout.string_flag_item, stringFlagsContainer, false);
        
        TextView nameText = view.findViewById(R.id.flag_name);
        EditText valueEdit = view.findViewById(R.id.flag_value);
        Button saveBtn = view.findViewById(R.id.save_button);
        Button deleteBtn = view.findViewById(R.id.delete_button);
        
        nameText.setText(flagName);
        valueEdit.setText(value);
        
        saveBtn.setOnClickListener(v -> {
            String newValue = valueEdit.getText().toString();
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString(STRING_FLAGS_KEY + "_" + flagName, newValue);
            editor.apply();
            Toast.makeText(MainActivity.this, "Saved: " + flagName + " = " + newValue, Toast.LENGTH_SHORT).show();
        });
        
        deleteBtn.setOnClickListener(v -> {
            // Don't allow deleting default configs
            if (defaultConfigs.containsKey(flagName)) {
                Toast.makeText(MainActivity.this, "Cannot delete default config", Toast.LENGTH_SHORT).show();
                return;
            }
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.remove(STRING_FLAGS_KEY + "_" + flagName);
            editor.apply();
            stringFlagsContainer.removeView(view);
            Toast.makeText(MainActivity.this, "Deleted: " + flagName, Toast.LENGTH_SHORT).show();
        });
        
        stringFlagsContainer.addView(view);
    }

    private void showAddBooleanFlagDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_add_boolean_flag, null);
        
        EditText flagNameInput = dialogView.findViewById(R.id.flag_name_input);
        Switch flagValueSwitch = dialogView.findViewById(R.id.flag_value_switch);
        
        builder.setTitle("Add Boolean Feature Flag")
               .setView(dialogView)
               .setPositiveButton("Add", (dialog, which) -> {
                   String flagName = flagNameInput.getText().toString().trim();
                   boolean flagValue = flagValueSwitch.isChecked();
                   
                   if (!flagName.isEmpty()) {
                       SharedPreferences.Editor editor = prefs.edit();
                       editor.putBoolean(BOOLEAN_FLAGS_KEY + "_" + flagName, flagValue);
                       editor.apply();
                       
                       addBooleanFlagView(flagName, flagValue);
                       Toast.makeText(MainActivity.this, "Added: " + flagName + " = " + flagValue, Toast.LENGTH_SHORT).show();
                   }
               })
               .setNegativeButton("Cancel", null)
               .show();
    }

    private void showAddStringFlagDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_add_string_flag, null);
        
        EditText flagNameInput = dialogView.findViewById(R.id.flag_name_input);
        EditText flagValueInput = dialogView.findViewById(R.id.flag_value_input);
        
        builder.setTitle("Add String/Float Feature Flag")
               .setView(dialogView)
               .setPositiveButton("Add", (dialog, which) -> {
                   String flagName = flagNameInput.getText().toString().trim();
                   String flagValue = flagValueInput.getText().toString();
                   
                   if (!flagName.isEmpty()) {
                       SharedPreferences.Editor editor = prefs.edit();
                       editor.putString(STRING_FLAGS_KEY + "_" + flagName, flagValue);
                       editor.apply();
                       
                       addStringFlagView(flagName, flagValue);
                       Toast.makeText(MainActivity.this, "Added: " + flagName + " = " + flagValue, Toast.LENGTH_SHORT).show();
                   }
               })
               .setNegativeButton("Cancel", null)
               .show();
    }

    private void resetToDefaults() {
        new AlertDialog.Builder(this)
            .setTitle("Reset to Defaults")
            .setMessage("This will reset all feature flags to their default values. Continue?")
            .setPositiveButton("Yes", (dialog, which) -> {
                SharedPreferences.Editor editor = prefs.edit();
                editor.clear();
                
                // Restore default boolean values
                for (Map.Entry<String, Boolean> entry : defaultBooleanToggles.entrySet()) {
                    editor.putBoolean(BOOLEAN_FLAGS_KEY + "_" + entry.getKey(), entry.getValue());
                }
                
                // Restore default string values
                for (Map.Entry<String, String> entry : defaultConfigs.entrySet()) {
                    editor.putString(STRING_FLAGS_KEY + "_" + entry.getKey(), entry.getValue());
                }
                
                editor.apply();
                
                // Refresh UI
                loadBooleanFlags();
                loadStringFlags();
                
                Toast.makeText(MainActivity.this, "Reset to defaults", Toast.LENGTH_SHORT).show();
            })
            .setNegativeButton("No", null)
            .show();
    }
}