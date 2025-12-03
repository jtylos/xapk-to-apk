package com.firebaseconfigmanager.ui

import android.content.SharedPreferences
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.firebaseconfigmanager.data.ConfigEntry
import com.firebaseconfigmanager.data.ConfigStorage
import com.firebaseconfigmanager.data.ConfigType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfigManagerApp() {
    val context = LocalContext.current
    val prefs = remember { ConfigStorage.getPrefs(context) }
    
    var configs by remember { mutableStateOf(ConfigStorage.getAllConfigs(prefs)) }
    var searchQuery by remember { mutableStateOf("") }
    var filterType by remember { mutableStateOf<ConfigType?>(null) }
    var showOnlyOverridden by remember { mutableStateOf(false) }
    var selectedConfig by remember { mutableStateOf<ConfigEntry?>(null) }
    var showClearDialog by remember { mutableStateOf(false) }

    // Refresh configs
    fun refreshConfigs() {
        configs = ConfigStorage.getAllConfigs(prefs)
    }

    // Filter configs
    val filteredConfigs = configs.filter { config ->
        val matchesSearch = searchQuery.isEmpty() || 
            config.name.contains(searchQuery, ignoreCase = true)
        val matchesType = filterType == null || config.type == filterType
        val matchesOverridden = !showOnlyOverridden || config.isOverridden
        matchesSearch && matchesType && matchesOverridden
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Firebase Config Manager",
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                actions = {
                    IconButton(onClick = { refreshConfigs() }) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = "Refresh",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                    IconButton(onClick = { showClearDialog = true }) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Clear Overrides",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search and Filter Bar
            SearchFilterBar(
                searchQuery = searchQuery,
                onSearchQueryChange = { searchQuery = it },
                filterType = filterType,
                onFilterTypeChange = { filterType = it },
                showOnlyOverridden = showOnlyOverridden,
                onShowOnlyOverriddenChange = { showOnlyOverridden = it }
            )

            // Stats Bar
            StatsBar(
                total = configs.size,
                filtered = filteredConfigs.size,
                overridden = configs.count { it.isOverridden }
            )

            // Config List
            if (filteredConfigs.isEmpty()) {
                EmptyState()
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredConfigs, key = { it.name }) { config ->
                        ConfigCard(
                            config = config,
                            onClick = { selectedConfig = config }
                        )
                    }
                }
            }
        }
    }

    // Edit Dialog
    selectedConfig?.let { config ->
        EditConfigDialog(
            config = config,
            onDismiss = { selectedConfig = null },
            onSave = { newValue ->
                ConfigStorage.saveOverride(prefs, config.name, newValue)
                refreshConfigs()
                selectedConfig = null
            },
            onReset = {
                ConfigStorage.saveOverride(prefs, config.name, null)
                refreshConfigs()
                selectedConfig = null
            }
        )
    }

    // Clear Confirmation Dialog
    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { showClearDialog = false },
            title = { Text("Clear All Overrides") },
            text = { Text("Are you sure you want to reset all configs to their default values?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        ConfigStorage.clearAllOverrides(prefs)
                        refreshConfigs()
                        showClearDialog = false
                    }
                ) {
                    Text("Clear", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchFilterBar(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    filterType: ConfigType?,
    onFilterTypeChange: (ConfigType?) -> Unit,
    showOnlyOverridden: Boolean,
    onShowOnlyOverriddenChange: (Boolean) -> Unit
) {
    var showFilterMenu by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
    ) {
        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchQueryChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Search configs...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchQueryChange("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear")
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Filter Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Type Filter
            Box {
                FilterChip(
                    selected = filterType != null,
                    onClick = { showFilterMenu = true },
                    label = { Text(filterType?.name ?: "All Types") },
                    leadingIcon = {
                        Icon(
                            Icons.Default.FilterList,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                )
                DropdownMenu(
                    expanded = showFilterMenu,
                    onDismissRequest = { showFilterMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("All Types") },
                        onClick = {
                            onFilterTypeChange(null)
                            showFilterMenu = false
                        }
                    )
                    ConfigType.values().forEach { type ->
                        DropdownMenuItem(
                            text = { Text(type.name) },
                            onClick = {
                                onFilterTypeChange(type)
                                showFilterMenu = false
                            }
                        )
                    }
                }
            }

            // Overridden Filter
            FilterChip(
                selected = showOnlyOverridden,
                onClick = { onShowOnlyOverriddenChange(!showOnlyOverridden) },
                label = { Text("Overridden") },
                leadingIcon = {
                    if (showOnlyOverridden) {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            )
        }
    }
}

@Composable
fun StatsBar(total: Int, filtered: Int, overridden: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = "Total: $total",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "Showing: $filtered",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "Overridden: $overridden",
            fontSize = 12.sp,
            color = if (overridden > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun ConfigCard(
    config: ConfigEntry,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (config.isOverridden) 
                MaterialTheme.colorScheme.primaryContainer 
            else 
                MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Type Icon
            TypeIcon(type = config.type)

            Spacer(modifier = Modifier.width(12.dp))

            // Config Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = config.name,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (config.isOverridden) {
                        // Show both default and current
                        Text(
                            text = "Default: ${config.defaultValue}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Icon(
                            Icons.Default.ArrowForward,
                            contentDescription = null,
                            modifier = Modifier
                                .padding(horizontal = 4.dp)
                                .size(12.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = config.currentValue,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    } else {
                        Text(
                            text = "Value: ${config.currentValue}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Override Indicator
            if (config.isOverridden) {
                Icon(
                    Icons.Default.Edit,
                    contentDescription = "Overridden",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
fun TypeIcon(type: ConfigType) {
    val (icon, color) = when (type) {
        ConfigType.BOOLEAN -> Icons.Default.ToggleOn to Color(0xFF4CAF50)
        ConfigType.STRING -> Icons.Default.TextFields to Color(0xFF2196F3)
        ConfigType.FLOAT -> Icons.Default.Numbers to Color(0xFFFF9800)
        ConfigType.INT -> Icons.Default.Numbers to Color(0xFF9C27B0)
    }
    
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.1f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            icon,
            contentDescription = type.name,
            tint = color,
            modifier = Modifier.size(24.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditConfigDialog(
    config: ConfigEntry,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
    onReset: () -> Unit
) {
    var editValue by remember { mutableStateOf(config.currentValue) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Edit Config",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Config Name
                Text(
                    text = config.name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Type Badge
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Type: ",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    AssistChip(
                        onClick = {},
                        label = { Text(config.type.name, fontSize = 10.sp) }
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Default Value
                Text(
                    text = "Default: ${config.defaultValue}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Value Input
                when (config.type) {
                    ConfigType.BOOLEAN -> {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Value")
                            Switch(
                                checked = editValue.toBoolean(),
                                onCheckedChange = { editValue = it.toString() }
                            )
                        }
                    }
                    else -> {
                        OutlinedTextField(
                            value = editValue,
                            onValueChange = { editValue = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Value") },
                            singleLine = true
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (config.isOverridden) {
                        OutlinedButton(
                            onClick = onReset,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Reset")
                        }
                    }
                    
                    TextButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }
                    
                    Button(
                        onClick = { onSave(editValue) },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Save")
                    }
                }
            }
        }
    }
}

@Composable
fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                Icons.Default.Settings,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "No configs found",
                fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Open the target app to discover configs",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
        }
    }
}
