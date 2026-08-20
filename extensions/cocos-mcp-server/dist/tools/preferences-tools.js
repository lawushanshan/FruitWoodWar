"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferencesTools = void 0;
class PreferencesTools {
    getTools() {
        return [
            {
                name: 'preferences_manage',
                description: 'PREFERENCES MANAGEMENT: Configure Cocos Creator editor settings and open preferences panel. WORKFLOW: open_panel to access GUI settings, get_config to read current values, set_config to modify settings, reset_config to restore defaults. Supports global/local/default scopes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['open_panel', 'get_config', 'set_config', 'reset_config'],
                            description: 'Preference operation: "open_panel" = launch preferences GUI (optional tab parameter) | "get_config" = read configuration values (requires category+path) | "set_config" = modify settings (requires category+path+value) | "reset_config" = restore defaults (requires category)'
                        },
                        // For open_panel action
                        tab: {
                            type: 'string',
                            enum: ['general', 'external-tools', 'data-editor', 'laboratory', 'extensions', 'preview', 'console', 'native', 'builder'],
                            description: 'Preferences tab to display (open_panel action). Available tabs: "general" (basic settings), "external-tools" (editor tools), "data-editor" (data editing), "laboratory" (experimental features), "extensions" (plugins), "preview" (preview settings), "console" (console config), "native" (native build), "builder" (build settings).'
                        },
                        // For get_config/set_config/reset_config actions
                        category: {
                            type: 'string',
                            enum: ['general', 'external-tools', 'data-editor', 'laboratory', 'extensions', 'preview', 'console', 'native', 'builder'],
                            description: 'Configuration category (REQUIRED for get_config/set_config/reset_config). Categories match preferences tabs. "general" = basic editor settings, "external-tools" = tool integration, "data-editor" = data editing preferences. Default: general for common settings.',
                            default: 'general'
                        },
                        path: {
                            type: 'string',
                            description: 'Setting path within category (REQUIRED for get_config/set_config). Use dot notation for nested values. Examples: "editor.fontSize" for editor text size, "preview.autoRefresh" for auto-refresh setting. Check available paths with get_all action first.'
                        },
                        value: {
                            description: 'New setting value (REQUIRED for set_config). Type depends on setting: string for paths/names, number for sizes/delays, boolean for on/off options, object for complex settings. Examples: 14 for fontSize, true for autoSave, "/usr/bin/code" for editor path.'
                        },
                        scope: {
                            type: 'string',
                            enum: ['global', 'local', 'default'],
                            description: 'Setting scope level. "global" = applies to all projects (most common), "local" = current project only (overrides global), "default" = factory settings (read-only for comparison). Recommended: global for general preferences, local for project-specific overrides.',
                            default: 'global'
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'preferences_query',
                description: 'PREFERENCES QUERY: Get all available preferences, list categories, or search for specific preference settings. Use this for preference discovery and inspection.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['get_all', 'list_categories', 'search_settings'],
                            description: 'Query action: "get_all" = retrieve all preference configurations | "list_categories" = get available preference categories | "search_settings" = find settings by keyword'
                        },
                        // For get_all action
                        scope: {
                            type: 'string',
                            enum: ['global', 'local', 'default'],
                            description: 'Configuration scope to query (get_all action only)',
                            default: 'global'
                        },
                        categories: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['general', 'external-tools', 'data-editor', 'laboratory', 'extensions', 'preview', 'console', 'native', 'builder']
                            },
                            description: 'Specific categories to include (get_all action only). If not specified, all categories are included.'
                        },
                        // For search_settings action
                        keyword: {
                            type: 'string',
                            description: 'Search keyword for finding settings (search_settings action only)'
                        },
                        includeValues: {
                            type: 'boolean',
                            description: 'Include current values in search results (search_settings action only)',
                            default: true
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'preferences_backup',
                description: 'PREFERENCES BACKUP: Export current preferences to JSON format or prepare for backup operations. Use this for preference backup and restore workflows.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['export', 'validate_backup'],
                            description: 'Backup action: "export" = export preferences to JSON | "validate_backup" = check backup file format'
                        },
                        // For export action
                        categories: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['general', 'external-tools', 'data-editor', 'laboratory', 'extensions', 'preview', 'console', 'native', 'builder']
                            },
                            description: 'Categories to export (export action only). If not specified, all categories are exported.'
                        },
                        scope: {
                            type: 'string',
                            enum: ['global', 'local'],
                            description: 'Configuration scope to export (export action only)',
                            default: 'global'
                        },
                        includeDefaults: {
                            type: 'boolean',
                            description: 'Include default values in export (export action only)',
                            default: false
                        },
                        // For validate_backup action
                        backupData: {
                            type: 'object',
                            description: 'Backup data to validate (validate_backup action only)'
                        }
                    },
                    required: ['action']
                }
            }
        ];
    }
    async execute(toolName, args) {
        switch (toolName) {
            case 'preferences_manage':
                return await this.handlePreferencesManage(args);
            case 'preferences_query':
                return await this.handlePreferencesQuery(args);
            case 'preferences_backup':
                return await this.handlePreferencesBackup(args);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    // New consolidated handlers
    async handlePreferencesManage(args) {
        const { action } = args;
        switch (action) {
            case 'open_panel':
                return await this.openPreferencesPanel(args.tab);
            case 'get_config':
                return await this.getPreferencesConfig(args.category, args.path, args.scope);
            case 'set_config':
                return await this.setPreferencesConfig(args.category, args.path, args.value, args.scope);
            case 'reset_config':
                return await this.resetPreferencesConfig(args.category, args.scope);
            default:
                return { success: false, error: `Unknown preferences manage action: ${action}` };
        }
    }
    async handlePreferencesQuery(args) {
        const { action } = args;
        switch (action) {
            case 'get_all':
                return await this.getAllPreferences(args.scope, args.categories);
            case 'list_categories':
                return await this.listPreferencesCategories();
            case 'search_settings':
                return await this.searchPreferencesSettings(args.keyword, args.includeValues);
            default:
                return { success: false, error: `Unknown preferences query action: ${action}` };
        }
    }
    async handlePreferencesBackup(args) {
        const { action } = args;
        switch (action) {
            case 'export':
                return await this.exportPreferences(args.categories, args.scope, args.includeDefaults);
            case 'validate_backup':
                return await this.validateBackupData(args.backupData);
            default:
                return { success: false, error: `Unknown preferences backup action: ${action}` };
        }
    }
    // Implementation methods
    async openPreferencesPanel(tab) {
        try {
            const requestArgs = tab ? [tab] : [];
            await Editor.Message.request('preferences', 'open-settings', ...requestArgs);
            return {
                success: true,
                message: `✅ Preferences panel opened${tab ? ` on "${tab}" tab` : ''}`,
                data: { tab: tab || 'general' }
            };
        }
        catch (err) {
            return { success: false, error: `Failed to open preferences panel: ${err.message}` };
        }
    }
    async getPreferencesConfig(category, path, scope = 'global') {
        // Validate category parameter
        if (!category || typeof category !== 'string' || category.trim().length === 0) {
            return {
                success: false,
                error: 'Category is required and must be a non-empty string'
            };
        }
        const trimmedCategory = category.trim();
        const requestArgs = [trimmedCategory];
        if (path && typeof path === 'string' && path.trim().length > 0) {
            requestArgs.push(path.trim());
        }
        requestArgs.push(scope);
        try {
            const config = await Editor.Message.request('preferences', 'query-config', ...requestArgs);
            return {
                success: true,
                message: `✅ Configuration retrieved for ${trimmedCategory}${path ? `.${path.trim()}` : ''}`,
                data: {
                    category: trimmedCategory,
                    path: path ? path.trim() : undefined,
                    scope,
                    config
                }
            };
        }
        catch (err) {
            return { success: false, error: `Failed to get preference config: ${err.message}` };
        }
    }
    async setPreferencesConfig(category, path, value, scope = 'global') {
        // Validate required parameters
        if (!category || typeof category !== 'string' || category.trim().length === 0) {
            return {
                success: false,
                error: 'Category is required and must be a non-empty string'
            };
        }
        if (!path || typeof path !== 'string' || path.trim().length === 0) {
            return {
                success: false,
                error: 'Path is required and must be a non-empty string'
            };
        }
        if (value === undefined) {
            return {
                success: false,
                error: 'Value is required and cannot be undefined'
            };
        }
        const trimmedCategory = category.trim();
        const trimmedPath = path.trim();
        try {
            const success = await Editor.Message.request('preferences', 'set-config', trimmedCategory, trimmedPath, value, scope);
            if (success) {
                return {
                    success: true,
                    message: `✅ Preference "${trimmedCategory}.${trimmedPath}" updated successfully`,
                    data: {
                        category: trimmedCategory,
                        path: trimmedPath,
                        value,
                        scope
                    }
                };
            }
            else {
                return {
                    success: false,
                    error: `Failed to update preference "${trimmedCategory}.${trimmedPath}". Value may be invalid or read-only.`
                };
            }
        }
        catch (err) {
            return { success: false, error: `Error setting preference: ${err.message}` };
        }
    }
    async resetPreferencesConfig(category, scope = 'global') {
        // Validate category parameter
        if (!category || typeof category !== 'string' || category.trim().length === 0) {
            return {
                success: false,
                error: 'Category is required and must be a non-empty string'
            };
        }
        const trimmedCategory = category.trim();
        try {
            // Get default configuration first
            const defaultConfig = await Editor.Message.request('preferences', 'query-config', trimmedCategory, undefined, 'default');
            if (!defaultConfig) {
                throw new Error(`No default configuration found for category "${trimmedCategory}"`);
            }
            // Apply default configuration
            const success = await Editor.Message.request('preferences', 'set-config', trimmedCategory, '', defaultConfig, scope);
            if (success) {
                return {
                    success: true,
                    message: `✅ Preference category "${trimmedCategory}" reset to defaults`,
                    data: {
                        category: trimmedCategory,
                        scope,
                        action: 'reset'
                    }
                };
            }
            else {
                return {
                    success: false,
                    error: `Failed to reset preference category "${trimmedCategory}". Category may not support reset operation.`
                };
            }
        }
        catch (err) {
            return { success: false, error: `Error resetting preferences: ${err.message}` };
        }
    }
    async getAllPreferences(scope = 'global', categories) {
        const availableCategories = [
            'general',
            'external-tools',
            'data-editor',
            'laboratory',
            'extensions',
            'preview',
            'console',
            'native',
            'builder'
        ];
        // Use specified categories or all available ones
        const categoriesToQuery = categories || availableCategories;
        const preferences = {};
        try {
            const queryPromises = categoriesToQuery.map(category => {
                return Editor.Message.request('preferences', 'query-config', category, undefined, scope)
                    .then((config) => {
                    preferences[category] = config;
                })
                    .catch(() => {
                    // Category doesn't exist or access denied
                    preferences[category] = null;
                });
            });
            await Promise.all(queryPromises);
            // Filter out null entries
            const validPreferences = Object.fromEntries(Object.entries(preferences).filter(([_, value]) => value !== null));
            return {
                success: true,
                message: `✅ Retrieved preferences for ${Object.keys(validPreferences).length} categories`,
                data: {
                    scope,
                    requestedCategories: categoriesToQuery,
                    availableCategories: Object.keys(validPreferences),
                    preferences: validPreferences,
                    summary: {
                        totalCategories: Object.keys(validPreferences).length,
                        scope: scope
                    }
                }
            };
        }
        catch (err) {
            return { success: false, error: `Error retrieving preferences: ${err.message}` };
        }
    }
    async listPreferencesCategories() {
        const categories = [
            { name: 'general', description: 'General editor settings and UI preferences' },
            { name: 'external-tools', description: 'External tool integrations and paths' },
            { name: 'data-editor', description: 'Data editor configurations and templates' },
            { name: 'laboratory', description: 'Experimental features and beta functionality' },
            { name: 'extensions', description: 'Extension manager and plugin settings' },
            { name: 'preview', description: 'Game preview and simulator settings' },
            { name: 'console', description: 'Console panel display and logging options' },
            { name: 'native', description: 'Native platform build configurations' },
            { name: 'builder', description: 'Build system and compilation settings' }
        ];
        return {
            success: true,
            message: `✅ Listed ${categories.length} available preference categories`,
            data: {
                categories,
                totalCount: categories.length,
                usage: 'Use these category names with preferences_manage or preferences_query tools'
            }
        };
    }
    async searchPreferencesSettings(keyword, includeValues = true) {
        var _a;
        try {
            // Validate keyword parameter
            if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
                return {
                    success: false,
                    error: 'Search keyword is required and must be a non-empty string'
                };
            }
            const trimmedKeyword = keyword.trim();
            const allPrefsResponse = await this.getAllPreferences('global');
            if (!allPrefsResponse.success) {
                return allPrefsResponse;
            }
            const preferences = ((_a = allPrefsResponse.data) === null || _a === void 0 ? void 0 : _a.preferences) || {};
            const searchResults = [];
            // Search through all categories and their settings
            for (const [category, config] of Object.entries(preferences)) {
                if (config && typeof config === 'object') {
                    this.searchInObject(config, trimmedKeyword, category, '', searchResults, includeValues);
                }
            }
            return {
                success: true,
                message: `✅ Found ${searchResults.length} settings matching "${trimmedKeyword}"`,
                data: {
                    keyword: trimmedKeyword,
                    includeValues,
                    resultCount: searchResults.length,
                    results: searchResults.slice(0, 50), // Limit results to prevent overwhelming output
                    hasMoreResults: searchResults.length > 50
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Search failed: ${error.message}`
            };
        }
    }
    searchInObject(obj, keyword, category, pathPrefix, results, includeValues) {
        if (!obj || typeof obj !== 'object' || !keyword || typeof keyword !== 'string') {
            return;
        }
        const lowerKeyword = keyword.toLowerCase();
        try {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof key !== 'string')
                    continue;
                const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
                const keyMatches = key.toLowerCase().includes(lowerKeyword);
                const valueMatches = typeof value === 'string' && value.toLowerCase().includes(lowerKeyword);
                if (keyMatches || valueMatches) {
                    const result = {
                        category,
                        path: currentPath,
                        key,
                        matchType: keyMatches ? (valueMatches ? 'both' : 'key') : 'value'
                    };
                    if (includeValues) {
                        result.value = value;
                        result.valueType = typeof value;
                    }
                    results.push(result);
                }
                // Recursively search nested objects (with depth limit to prevent infinite recursion)
                if (value && typeof value === 'object' && !Array.isArray(value) && pathPrefix.split('.').length < 10) {
                    this.searchInObject(value, keyword, category, currentPath, results, includeValues);
                }
            }
        }
        catch (error) {
            // Skip objects that can't be enumerated
        }
    }
    async exportPreferences(categories, scope = 'global', includeDefaults = false) {
        var _a, _b, _c, _d;
        try {
            // Validate scope parameter
            const validScopes = ['global', 'local'];
            if (!validScopes.includes(scope)) {
                return {
                    success: false,
                    error: `Invalid scope "${scope}". Must be one of: ${validScopes.join(', ')}`
                };
            }
            // Validate categories parameter if provided
            if (categories) {
                if (!Array.isArray(categories)) {
                    return {
                        success: false,
                        error: 'Categories must be an array'
                    };
                }
                const validCategories = ['general', 'external-tools', 'data-editor', 'laboratory', 'extensions', 'preview', 'console', 'native', 'builder'];
                const invalidCategories = categories.filter(cat => !validCategories.includes(cat));
                if (invalidCategories.length > 0) {
                    return {
                        success: false,
                        error: `Invalid categories: ${invalidCategories.join(', ')}. Valid categories are: ${validCategories.join(', ')}`
                    };
                }
            }
            const allPrefsResponse = await this.getAllPreferences(scope, categories);
            if (!allPrefsResponse.success) {
                return allPrefsResponse;
            }
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    scope: scope,
                    includeDefaults: includeDefaults,
                    cocosVersion: ((_a = Editor.versions) === null || _a === void 0 ? void 0 : _a.cocos) || 'Unknown',
                    exportedCategories: Object.keys(((_b = allPrefsResponse.data) === null || _b === void 0 ? void 0 : _b.preferences) || {}),
                    requestedCategories: categories || 'all'
                },
                preferences: ((_c = allPrefsResponse.data) === null || _c === void 0 ? void 0 : _c.preferences) || {}
            };
            // Include defaults if requested
            if (includeDefaults) {
                try {
                    const defaultsResponse = await this.getAllPreferences('default', categories);
                    if (defaultsResponse.success) {
                        exportData.defaults = ((_d = defaultsResponse.data) === null || _d === void 0 ? void 0 : _d.preferences) || {};
                    }
                    else {
                        exportData.metadata.defaultsWarning = 'Could not retrieve default preferences';
                    }
                }
                catch (error) {
                    exportData.metadata.defaultsWarning = 'Error retrieving default preferences';
                }
            }
            const jsonData = JSON.stringify(exportData, null, 2);
            const exportPath = `cocos_preferences_${scope}_${Date.now()}.json`;
            return {
                success: true,
                message: `✅ Preferences exported for ${exportData.metadata.exportedCategories.length} categories`,
                data: {
                    exportPath,
                    metadata: exportData.metadata,
                    preferences: exportData.preferences,
                    jsonData,
                    fileSize: Buffer.byteLength(jsonData, 'utf8'),
                    summary: {
                        totalCategories: exportData.metadata.exportedCategories.length,
                        scope: scope,
                        includeDefaults: includeDefaults,
                        hasDefaults: !!exportData.defaults
                    }
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Export failed: ${error.message}`
            };
        }
    }
    async validateBackupData(backupData) {
        try {
            const validation = {
                isValid: true,
                errors: [],
                warnings: [],
                metadata: null
            };
            // Check if backupData is provided
            if (backupData === undefined || backupData === null) {
                validation.isValid = false;
                validation.errors.push('Backup data is required and cannot be null or undefined');
                return {
                    success: false,
                    error: 'Backup data is required for validation'
                };
            }
            // Check basic structure
            if (typeof backupData !== 'object' || Array.isArray(backupData)) {
                validation.isValid = false;
                validation.errors.push('Backup data must be a valid object (not array or primitive type)');
            }
            else {
                // Check for metadata
                if (backupData.metadata) {
                    if (typeof backupData.metadata !== 'object') {
                        validation.errors.push('Metadata must be an object');
                        validation.isValid = false;
                    }
                    else {
                        validation.metadata = backupData.metadata;
                        if (!backupData.metadata.exportDate) {
                            validation.warnings.push('Missing export date in metadata');
                        }
                        else if (typeof backupData.metadata.exportDate !== 'string') {
                            validation.warnings.push('Export date should be a string');
                        }
                        if (!backupData.metadata.scope) {
                            validation.warnings.push('Missing scope information in metadata');
                        }
                        else if (!['global', 'local', 'default'].includes(backupData.metadata.scope)) {
                            validation.warnings.push('Invalid scope value in metadata');
                        }
                        if (backupData.metadata.cocosVersion && typeof backupData.metadata.cocosVersion !== 'string') {
                            validation.warnings.push('Cocos version should be a string');
                        }
                    }
                }
                else {
                    validation.warnings.push('No metadata found in backup file');
                }
                // Check for preferences data
                if (!backupData.preferences) {
                    validation.errors.push('No preferences data found in backup');
                    validation.isValid = false;
                }
                else if (typeof backupData.preferences !== 'object' || Array.isArray(backupData.preferences)) {
                    validation.errors.push('Preferences data must be an object (not array or primitive type)');
                    validation.isValid = false;
                }
                else {
                    // Count categories and validate structure
                    const categoryCount = Object.keys(backupData.preferences).length;
                    if (categoryCount === 0) {
                        validation.warnings.push('Backup contains no preference categories');
                    }
                    // Validate category names
                    const validCategories = ['general', 'external-tools', 'data-editor', 'laboratory', 'extensions', 'preview', 'console', 'native', 'builder'];
                    const invalidCategories = Object.keys(backupData.preferences).filter(cat => !validCategories.includes(cat));
                    if (invalidCategories.length > 0) {
                        validation.warnings.push(`Unknown categories found: ${invalidCategories.join(', ')}`);
                    }
                }
            }
            return {
                success: true,
                message: `✅ Backup validation completed: ${validation.isValid ? 'Valid' : 'Invalid'}`,
                data: {
                    isValid: validation.isValid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    metadata: validation.metadata,
                    summary: {
                        hasErrors: validation.errors.length > 0,
                        hasWarnings: validation.warnings.length > 0,
                        categoryCount: (backupData === null || backupData === void 0 ? void 0 : backupData.preferences) ? Object.keys(backupData.preferences).length : 0,
                        errorCount: validation.errors.length,
                        warningCount: validation.warnings.length
                    }
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Validation failed: ${error.message}`
            };
        }
    }
}
exports.PreferencesTools = PreferencesTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyZW5jZXMtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvcHJlZmVyZW5jZXMtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsTUFBYSxnQkFBZ0I7SUFDekIsUUFBUTtRQUNKLE9BQU87WUFDSDtnQkFDSSxJQUFJLEVBQUUsb0JBQW9CO2dCQUMxQixXQUFXLEVBQUUsb1JBQW9SO2dCQUNqUyxXQUFXLEVBQUU7b0JBQ1QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLE1BQU0sRUFBRTs0QkFDSixJQUFJLEVBQUUsUUFBUTs0QkFDZCxJQUFJLEVBQUUsQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxjQUFjLENBQUM7NEJBQ2hFLFdBQVcsRUFBRSxrUkFBa1I7eUJBQ2xTO3dCQUNELHdCQUF3Qjt3QkFDeEIsR0FBRyxFQUFFOzRCQUNELElBQUksRUFBRSxRQUFROzRCQUNkLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUM7NEJBQ3pILFdBQVcsRUFBRSx5VUFBeVU7eUJBQ3pWO3dCQUNELGlEQUFpRDt3QkFDakQsUUFBUSxFQUFFOzRCQUNOLElBQUksRUFBRSxRQUFROzRCQUNkLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUM7NEJBQ3pILFdBQVcsRUFBRSxzUUFBc1E7NEJBQ25SLE9BQU8sRUFBRSxTQUFTO3lCQUNyQjt3QkFDRCxJQUFJLEVBQUU7NEJBQ0YsSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLDJQQUEyUDt5QkFDM1E7d0JBQ0QsS0FB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QUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQzt3QkFDdkMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUM7d0JBQzNDLGFBQWEsRUFBRSxDQUFBLFVBQVUsYUFBVixVQUFVLHVCQUFWLFVBQVUsQ0FBRSxXQUFXLEVBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDdkYsVUFBVSxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsTUFBTTt3QkFDcEMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTTtxQkFDM0M7aUJBQ0o7YUFDSixDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTztnQkFDSCxPQUFPLEVBQUUsS0FBSztnQkFDZCxLQUFLLEVBQUUsc0JBQXNCLEtBQUssQ0FBQyxPQUFPLEVBQUU7YUFDL0MsQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0NBQ0o7QUFycUJELDRDQXFxQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUb29sRGVmaW5pdGlvbiwgVG9vbFJlc3BvbnNlLCBUb29sRXhlY3V0b3IgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgUHJlZmVyZW5jZXNUb29scyBpbXBsZW1lbnRzIFRvb2xFeGVjdXRvciB7XHJcbiAgICBnZXRUb29scygpOiBUb29sRGVmaW5pdGlvbltdIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAncHJlZmVyZW5jZXNfbWFuYWdlJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUFJFRkVSRU5DRVMgTUFOQUdFTUVOVDogQ29uZmlndXJlIENvY29zIENyZWF0b3IgZWRpdG9yIHNldHRpbmdzIGFuZCBvcGVuIHByZWZlcmVuY2VzIHBhbmVsLiBXT1JLRkxPVzogb3Blbl9wYW5lbCB0byBhY2Nlc3MgR1VJIHNldHRpbmdzLCBnZXRfY29uZmlnIHRvIHJlYWQgY3VycmVudCB2YWx1ZXMsIHNldF9jb25maWcgdG8gbW9kaWZ5IHNldHRpbmdzLCByZXNldF9jb25maWcgdG8gcmVzdG9yZSBkZWZhdWx0cy4gU3VwcG9ydHMgZ2xvYmFsL2xvY2FsL2RlZmF1bHQgc2NvcGVzLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnb3Blbl9wYW5lbCcsICdnZXRfY29uZmlnJywgJ3NldF9jb25maWcnLCAncmVzZXRfY29uZmlnJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZlcmVuY2Ugb3BlcmF0aW9uOiBcIm9wZW5fcGFuZWxcIiA9IGxhdW5jaCBwcmVmZXJlbmNlcyBHVUkgKG9wdGlvbmFsIHRhYiBwYXJhbWV0ZXIpIHwgXCJnZXRfY29uZmlnXCIgPSByZWFkIGNvbmZpZ3VyYXRpb24gdmFsdWVzIChyZXF1aXJlcyBjYXRlZ29yeStwYXRoKSB8IFwic2V0X2NvbmZpZ1wiID0gbW9kaWZ5IHNldHRpbmdzIChyZXF1aXJlcyBjYXRlZ29yeStwYXRoK3ZhbHVlKSB8IFwicmVzZXRfY29uZmlnXCIgPSByZXN0b3JlIGRlZmF1bHRzIChyZXF1aXJlcyBjYXRlZ29yeSknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBvcGVuX3BhbmVsIGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWI6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydnZW5lcmFsJywgJ2V4dGVybmFsLXRvb2xzJywgJ2RhdGEtZWRpdG9yJywgJ2xhYm9yYXRvcnknLCAnZXh0ZW5zaW9ucycsICdwcmV2aWV3JywgJ2NvbnNvbGUnLCAnbmF0aXZlJywgJ2J1aWxkZXInXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmVyZW5jZXMgdGFiIHRvIGRpc3BsYXkgKG9wZW5fcGFuZWwgYWN0aW9uKS4gQXZhaWxhYmxlIHRhYnM6IFwiZ2VuZXJhbFwiIChiYXNpYyBzZXR0aW5ncyksIFwiZXh0ZXJuYWwtdG9vbHNcIiAoZWRpdG9yIHRvb2xzKSwgXCJkYXRhLWVkaXRvclwiIChkYXRhIGVkaXRpbmcpLCBcImxhYm9yYXRvcnlcIiAoZXhwZXJpbWVudGFsIGZlYXR1cmVzKSwgXCJleHRlbnNpb25zXCIgKHBsdWdpbnMpLCBcInByZXZpZXdcIiAocHJldmlldyBzZXR0aW5ncyksIFwiY29uc29sZVwiIChjb25zb2xlIGNvbmZpZyksIFwibmF0aXZlXCIgKG5hdGl2ZSBidWlsZCksIFwiYnVpbGRlclwiIChidWlsZCBzZXR0aW5ncykuJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3IgZ2V0X2NvbmZpZy9zZXRfY29uZmlnL3Jlc2V0X2NvbmZpZyBhY3Rpb25zXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnZ2VuZXJhbCcsICdleHRlcm5hbC10b29scycsICdkYXRhLWVkaXRvcicsICdsYWJvcmF0b3J5JywgJ2V4dGVuc2lvbnMnLCAncHJldmlldycsICdjb25zb2xlJywgJ25hdGl2ZScsICdidWlsZGVyJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NvbmZpZ3VyYXRpb24gY2F0ZWdvcnkgKFJFUVVJUkVEIGZvciBnZXRfY29uZmlnL3NldF9jb25maWcvcmVzZXRfY29uZmlnKS4gQ2F0ZWdvcmllcyBtYXRjaCBwcmVmZXJlbmNlcyB0YWJzLiBcImdlbmVyYWxcIiA9IGJhc2ljIGVkaXRvciBzZXR0aW5ncywgXCJleHRlcm5hbC10b29sc1wiID0gdG9vbCBpbnRlZ3JhdGlvbiwgXCJkYXRhLWVkaXRvclwiID0gZGF0YSBlZGl0aW5nIHByZWZlcmVuY2VzLiBEZWZhdWx0OiBnZW5lcmFsIGZvciBjb21tb24gc2V0dGluZ3MuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdnZW5lcmFsJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2V0dGluZyBwYXRoIHdpdGhpbiBjYXRlZ29yeSAoUkVRVUlSRUQgZm9yIGdldF9jb25maWcvc2V0X2NvbmZpZykuIFVzZSBkb3Qgbm90YXRpb24gZm9yIG5lc3RlZCB2YWx1ZXMuIEV4YW1wbGVzOiBcImVkaXRvci5mb250U2l6ZVwiIGZvciBlZGl0b3IgdGV4dCBzaXplLCBcInByZXZpZXcuYXV0b1JlZnJlc2hcIiBmb3IgYXV0by1yZWZyZXNoIHNldHRpbmcuIENoZWNrIGF2YWlsYWJsZSBwYXRocyB3aXRoIGdldF9hbGwgYWN0aW9uIGZpcnN0LidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTmV3IHNldHRpbmcgdmFsdWUgKFJFUVVJUkVEIGZvciBzZXRfY29uZmlnKS4gVHlwZSBkZXBlbmRzIG9uIHNldHRpbmc6IHN0cmluZyBmb3IgcGF0aHMvbmFtZXMsIG51bWJlciBmb3Igc2l6ZXMvZGVsYXlzLCBib29sZWFuIGZvciBvbi9vZmYgb3B0aW9ucywgb2JqZWN0IGZvciBjb21wbGV4IHNldHRpbmdzLiBFeGFtcGxlczogMTQgZm9yIGZvbnRTaXplLCB0cnVlIGZvciBhdXRvU2F2ZSwgXCIvdXNyL2Jpbi9jb2RlXCIgZm9yIGVkaXRvciBwYXRoLidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydnbG9iYWwnLCAnbG9jYWwnLCAnZGVmYXVsdCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTZXR0aW5nIHNjb3BlIGxldmVsLiBcImdsb2JhbFwiID0gYXBwbGllcyB0byBhbGwgcHJvamVjdHMgKG1vc3QgY29tbW9uKSwgXCJsb2NhbFwiID0gY3VycmVudCBwcm9qZWN0IG9ubHkgKG92ZXJyaWRlcyBnbG9iYWwpLCBcImRlZmF1bHRcIiA9IGZhY3Rvcnkgc2V0dGluZ3MgKHJlYWQtb25seSBmb3IgY29tcGFyaXNvbikuIFJlY29tbWVuZGVkOiBnbG9iYWwgZm9yIGdlbmVyYWwgcHJlZmVyZW5jZXMsIGxvY2FsIGZvciBwcm9qZWN0LXNwZWNpZmljIG92ZXJyaWRlcy4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogJ2dsb2JhbCdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ByZWZlcmVuY2VzX3F1ZXJ5JyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUFJFRkVSRU5DRVMgUVVFUlk6IEdldCBhbGwgYXZhaWxhYmxlIHByZWZlcmVuY2VzLCBsaXN0IGNhdGVnb3JpZXMsIG9yIHNlYXJjaCBmb3Igc3BlY2lmaWMgcHJlZmVyZW5jZSBzZXR0aW5ncy4gVXNlIHRoaXMgZm9yIHByZWZlcmVuY2UgZGlzY292ZXJ5IGFuZCBpbnNwZWN0aW9uLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2FsbCcsICdsaXN0X2NhdGVnb3JpZXMnLCAnc2VhcmNoX3NldHRpbmdzJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1F1ZXJ5IGFjdGlvbjogXCJnZXRfYWxsXCIgPSByZXRyaWV2ZSBhbGwgcHJlZmVyZW5jZSBjb25maWd1cmF0aW9ucyB8IFwibGlzdF9jYXRlZ29yaWVzXCIgPSBnZXQgYXZhaWxhYmxlIHByZWZlcmVuY2UgY2F0ZWdvcmllcyB8IFwic2VhcmNoX3NldHRpbmdzXCIgPSBmaW5kIHNldHRpbmdzIGJ5IGtleXdvcmQnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBnZXRfYWxsIGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzY29wZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2dsb2JhbCcsICdsb2NhbCcsICdkZWZhdWx0J10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NvbmZpZ3VyYXRpb24gc2NvcGUgdG8gcXVlcnkgKGdldF9hbGwgYWN0aW9uIG9ubHkpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdnbG9iYWwnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3JpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnZ2VuZXJhbCcsICdleHRlcm5hbC10b29scycsICdkYXRhLWVkaXRvcicsICdsYWJvcmF0b3J5JywgJ2V4dGVuc2lvbnMnLCAncHJldmlldycsICdjb25zb2xlJywgJ25hdGl2ZScsICdidWlsZGVyJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NwZWNpZmljIGNhdGVnb3JpZXMgdG8gaW5jbHVkZSAoZ2V0X2FsbCBhY3Rpb24gb25seSkuIElmIG5vdCBzcGVjaWZpZWQsIGFsbCBjYXRlZ29yaWVzIGFyZSBpbmNsdWRlZC4nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBzZWFyY2hfc2V0dGluZ3MgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXdvcmQ6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTZWFyY2gga2V5d29yZCBmb3IgZmluZGluZyBzZXR0aW5ncyAoc2VhcmNoX3NldHRpbmdzIGFjdGlvbiBvbmx5KSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZVZhbHVlczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbmNsdWRlIGN1cnJlbnQgdmFsdWVzIGluIHNlYXJjaCByZXN1bHRzIChzZWFyY2hfc2V0dGluZ3MgYWN0aW9uIG9ubHkpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ByZWZlcmVuY2VzX2JhY2t1cCcsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BSRUZFUkVOQ0VTIEJBQ0tVUDogRXhwb3J0IGN1cnJlbnQgcHJlZmVyZW5jZXMgdG8gSlNPTiBmb3JtYXQgb3IgcHJlcGFyZSBmb3IgYmFja3VwIG9wZXJhdGlvbnMuIFVzZSB0aGlzIGZvciBwcmVmZXJlbmNlIGJhY2t1cCBhbmQgcmVzdG9yZSB3b3JrZmxvd3MuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydleHBvcnQnLCAndmFsaWRhdGVfYmFja3VwJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0JhY2t1cCBhY3Rpb246IFwiZXhwb3J0XCIgPSBleHBvcnQgcHJlZmVyZW5jZXMgdG8gSlNPTiB8IFwidmFsaWRhdGVfYmFja3VwXCIgPSBjaGVjayBiYWNrdXAgZmlsZSBmb3JtYXQnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBleHBvcnQgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3JpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnZ2VuZXJhbCcsICdleHRlcm5hbC10b29scycsICdkYXRhLWVkaXRvcicsICdsYWJvcmF0b3J5JywgJ2V4dGVuc2lvbnMnLCAncHJldmlldycsICdjb25zb2xlJywgJ25hdGl2ZScsICdidWlsZGVyJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NhdGVnb3JpZXMgdG8gZXhwb3J0IChleHBvcnQgYWN0aW9uIG9ubHkpLiBJZiBub3Qgc3BlY2lmaWVkLCBhbGwgY2F0ZWdvcmllcyBhcmUgZXhwb3J0ZWQuJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzY29wZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2dsb2JhbCcsICdsb2NhbCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdDb25maWd1cmF0aW9uIHNjb3BlIHRvIGV4cG9ydCAoZXhwb3J0IGFjdGlvbiBvbmx5KScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2xvYmFsJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlRGVmYXVsdHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBkZWZhdWx0IHZhbHVlcyBpbiBleHBvcnQgKGV4cG9ydCBhY3Rpb24gb25seSknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHZhbGlkYXRlX2JhY2t1cCBhY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgYmFja3VwRGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0JhY2t1cCBkYXRhIHRvIHZhbGlkYXRlICh2YWxpZGF0ZV9iYWNrdXAgYWN0aW9uIG9ubHkpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBleGVjdXRlKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgc3dpdGNoICh0b29sTmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlICdwcmVmZXJlbmNlc19tYW5hZ2UnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuaGFuZGxlUHJlZmVyZW5jZXNNYW5hZ2UoYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3ByZWZlcmVuY2VzX3F1ZXJ5JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZVByZWZlcmVuY2VzUXVlcnkoYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3ByZWZlcmVuY2VzX2JhY2t1cCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5oYW5kbGVQcmVmZXJlbmNlc0JhY2t1cChhcmdzKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0b29sOiAke3Rvb2xOYW1lfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBOZXcgY29uc29saWRhdGVkIGhhbmRsZXJzXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVByZWZlcmVuY2VzTWFuYWdlKGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24gfSA9IGFyZ3M7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnb3Blbl9wYW5lbCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5vcGVuUHJlZmVyZW5jZXNQYW5lbChhcmdzLnRhYik7XHJcbiAgICAgICAgICAgIGNhc2UgJ2dldF9jb25maWcnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0UHJlZmVyZW5jZXNDb25maWcoYXJncy5jYXRlZ29yeSwgYXJncy5wYXRoLCBhcmdzLnNjb3BlKTtcclxuICAgICAgICAgICAgY2FzZSAnc2V0X2NvbmZpZyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zZXRQcmVmZXJlbmNlc0NvbmZpZyhhcmdzLmNhdGVnb3J5LCBhcmdzLnBhdGgsIGFyZ3MudmFsdWUsIGFyZ3Muc2NvcGUpO1xyXG4gICAgICAgICAgICBjYXNlICdyZXNldF9jb25maWcnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucmVzZXRQcmVmZXJlbmNlc0NvbmZpZyhhcmdzLmNhdGVnb3J5LCBhcmdzLnNjb3BlKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFVua25vd24gcHJlZmVyZW5jZXMgbWFuYWdlIGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVByZWZlcmVuY2VzUXVlcnkoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdnZXRfYWxsJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldEFsbFByZWZlcmVuY2VzKGFyZ3Muc2NvcGUsIGFyZ3MuY2F0ZWdvcmllcyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2xpc3RfY2F0ZWdvcmllcyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5saXN0UHJlZmVyZW5jZXNDYXRlZ29yaWVzKCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NlYXJjaF9zZXR0aW5ncyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zZWFyY2hQcmVmZXJlbmNlc1NldHRpbmdzKGFyZ3Mua2V5d29yZCwgYXJncy5pbmNsdWRlVmFsdWVzKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFVua25vd24gcHJlZmVyZW5jZXMgcXVlcnkgYWN0aW9uOiAke2FjdGlvbn1gIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlUHJlZmVyZW5jZXNCYWNrdXAoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdleHBvcnQnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZXhwb3J0UHJlZmVyZW5jZXMoYXJncy5jYXRlZ29yaWVzLCBhcmdzLnNjb3BlLCBhcmdzLmluY2x1ZGVEZWZhdWx0cyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3ZhbGlkYXRlX2JhY2t1cCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy52YWxpZGF0ZUJhY2t1cERhdGEoYXJncy5iYWNrdXBEYXRhKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFVua25vd24gcHJlZmVyZW5jZXMgYmFja3VwIGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBJbXBsZW1lbnRhdGlvbiBtZXRob2RzXHJcbiAgICBwcml2YXRlIGFzeW5jIG9wZW5QcmVmZXJlbmNlc1BhbmVsKHRhYj86IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVxdWVzdEFyZ3MgPSB0YWIgPyBbdGFiXSA6IFtdO1xyXG4gICAgICAgICAgICBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdvcGVuLXNldHRpbmdzJywgLi4ucmVxdWVzdEFyZ3MpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgUHJlZmVyZW5jZXMgcGFuZWwgb3BlbmVkJHt0YWIgPyBgIG9uIFwiJHt0YWJ9XCIgdGFiYCA6ICcnfWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7IHRhYjogdGFiIHx8ICdnZW5lcmFsJyB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIG9wZW4gcHJlZmVyZW5jZXMgcGFuZWw6ICR7ZXJyLm1lc3NhZ2V9YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFByZWZlcmVuY2VzQ29uZmlnKGNhdGVnb3J5OiBzdHJpbmcsIHBhdGg/OiBzdHJpbmcsIHNjb3BlOiBzdHJpbmcgPSAnZ2xvYmFsJyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgLy8gVmFsaWRhdGUgY2F0ZWdvcnkgcGFyYW1ldGVyXHJcbiAgICAgICAgaWYgKCFjYXRlZ29yeSB8fCB0eXBlb2YgY2F0ZWdvcnkgIT09ICdzdHJpbmcnIHx8IGNhdGVnb3J5LnRyaW0oKS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdDYXRlZ29yeSBpcyByZXF1aXJlZCBhbmQgbXVzdCBiZSBhIG5vbi1lbXB0eSBzdHJpbmcnXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB0cmltbWVkQ2F0ZWdvcnkgPSBjYXRlZ29yeS50cmltKCk7XHJcbiAgICAgICAgY29uc3QgcmVxdWVzdEFyZ3MgPSBbdHJpbW1lZENhdGVnb3J5XTtcclxuICAgICAgICBpZiAocGF0aCAmJiB0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycgJiYgcGF0aC50cmltKCkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICByZXF1ZXN0QXJncy5wdXNoKHBhdGgudHJpbSgpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVxdWVzdEFyZ3MucHVzaChzY29wZSk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3ByZWZlcmVuY2VzJywgJ3F1ZXJ5LWNvbmZpZycsIC4uLnJlcXVlc3RBcmdzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIENvbmZpZ3VyYXRpb24gcmV0cmlldmVkIGZvciAke3RyaW1tZWRDYXRlZ29yeX0ke3BhdGggPyBgLiR7cGF0aC50cmltKCl9YCA6ICcnfWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6IHRyaW1tZWRDYXRlZ29yeSxcclxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBwYXRoID8gcGF0aC50cmltKCkgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUsXHJcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGdldCBwcmVmZXJlbmNlIGNvbmZpZzogJHtlcnIubWVzc2FnZX1gIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0UHJlZmVyZW5jZXNDb25maWcoY2F0ZWdvcnk6IHN0cmluZywgcGF0aDogc3RyaW5nLCB2YWx1ZTogYW55LCBzY29wZTogc3RyaW5nID0gJ2dsb2JhbCcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIC8vIFZhbGlkYXRlIHJlcXVpcmVkIHBhcmFtZXRlcnNcclxuICAgICAgICBpZiAoIWNhdGVnb3J5IHx8IHR5cGVvZiBjYXRlZ29yeSAhPT0gJ3N0cmluZycgfHwgY2F0ZWdvcnkudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogJ0NhdGVnb3J5IGlzIHJlcXVpcmVkIGFuZCBtdXN0IGJlIGEgbm9uLWVtcHR5IHN0cmluZydcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghcGF0aCB8fCB0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycgfHwgcGF0aC50cmltKCkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiAnUGF0aCBpcyByZXF1aXJlZCBhbmQgbXVzdCBiZSBhIG5vbi1lbXB0eSBzdHJpbmcnXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogJ1ZhbHVlIGlzIHJlcXVpcmVkIGFuZCBjYW5ub3QgYmUgdW5kZWZpbmVkJ1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgdHJpbW1lZENhdGVnb3J5ID0gY2F0ZWdvcnkudHJpbSgpO1xyXG4gICAgICAgIGNvbnN0IHRyaW1tZWRQYXRoID0gcGF0aC50cmltKCk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdzZXQtY29uZmlnJywgdHJpbW1lZENhdGVnb3J5LCB0cmltbWVkUGF0aCwgdmFsdWUsIHNjb3BlKTtcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIFByZWZlcmVuY2UgXCIke3RyaW1tZWRDYXRlZ29yeX0uJHt0cmltbWVkUGF0aH1cIiB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAsXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeTogdHJpbW1lZENhdGVnb3J5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiB0cmltbWVkUGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gdXBkYXRlIHByZWZlcmVuY2UgXCIke3RyaW1tZWRDYXRlZ29yeX0uJHt0cmltbWVkUGF0aH1cIi4gVmFsdWUgbWF5IGJlIGludmFsaWQgb3IgcmVhZC1vbmx5LmBcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBzZXR0aW5nIHByZWZlcmVuY2U6ICR7ZXJyLm1lc3NhZ2V9YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlc2V0UHJlZmVyZW5jZXNDb25maWcoY2F0ZWdvcnk6IHN0cmluZywgc2NvcGU6IHN0cmluZyA9ICdnbG9iYWwnKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICAvLyBWYWxpZGF0ZSBjYXRlZ29yeSBwYXJhbWV0ZXJcclxuICAgICAgICBpZiAoIWNhdGVnb3J5IHx8IHR5cGVvZiBjYXRlZ29yeSAhPT0gJ3N0cmluZycgfHwgY2F0ZWdvcnkudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogJ0NhdGVnb3J5IGlzIHJlcXVpcmVkIGFuZCBtdXN0IGJlIGEgbm9uLWVtcHR5IHN0cmluZydcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHRyaW1tZWRDYXRlZ29yeSA9IGNhdGVnb3J5LnRyaW0oKTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gR2V0IGRlZmF1bHQgY29uZmlndXJhdGlvbiBmaXJzdFxyXG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0Q29uZmlnID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgncHJlZmVyZW5jZXMnLCAncXVlcnktY29uZmlnJywgdHJpbW1lZENhdGVnb3J5LCB1bmRlZmluZWQsICdkZWZhdWx0Jyk7XHJcbiAgICAgICAgICAgIGlmICghZGVmYXVsdENvbmZpZykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBkZWZhdWx0IGNvbmZpZ3VyYXRpb24gZm91bmQgZm9yIGNhdGVnb3J5IFwiJHt0cmltbWVkQ2F0ZWdvcnl9XCJgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBBcHBseSBkZWZhdWx0IGNvbmZpZ3VyYXRpb25cclxuICAgICAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3ByZWZlcmVuY2VzJywgJ3NldC1jb25maWcnLCB0cmltbWVkQ2F0ZWdvcnksICcnLCBkZWZhdWx0Q29uZmlnLCBzY29wZSk7XHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBQcmVmZXJlbmNlIGNhdGVnb3J5IFwiJHt0cmltbWVkQ2F0ZWdvcnl9XCIgcmVzZXQgdG8gZGVmYXVsdHNgLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6IHRyaW1tZWRDYXRlZ29yeSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjogJ3Jlc2V0J1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgRmFpbGVkIHRvIHJlc2V0IHByZWZlcmVuY2UgY2F0ZWdvcnkgXCIke3RyaW1tZWRDYXRlZ29yeX1cIi4gQ2F0ZWdvcnkgbWF5IG5vdCBzdXBwb3J0IHJlc2V0IG9wZXJhdGlvbi5gXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRXJyb3IgcmVzZXR0aW5nIHByZWZlcmVuY2VzOiAke2Vyci5tZXNzYWdlfWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBbGxQcmVmZXJlbmNlcyhzY29wZTogc3RyaW5nID0gJ2dsb2JhbCcsIGNhdGVnb3JpZXM/OiBzdHJpbmdbXSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlQ2F0ZWdvcmllcyA9IFtcclxuICAgICAgICAgICAgJ2dlbmVyYWwnLFxyXG4gICAgICAgICAgICAnZXh0ZXJuYWwtdG9vbHMnLFxyXG4gICAgICAgICAgICAnZGF0YS1lZGl0b3InLFxyXG4gICAgICAgICAgICAnbGFib3JhdG9yeScsXHJcbiAgICAgICAgICAgICdleHRlbnNpb25zJyxcclxuICAgICAgICAgICAgJ3ByZXZpZXcnLFxyXG4gICAgICAgICAgICAnY29uc29sZScsXHJcbiAgICAgICAgICAgICduYXRpdmUnLFxyXG4gICAgICAgICAgICAnYnVpbGRlcidcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICAvLyBVc2Ugc3BlY2lmaWVkIGNhdGVnb3JpZXMgb3IgYWxsIGF2YWlsYWJsZSBvbmVzXHJcbiAgICAgICAgY29uc3QgY2F0ZWdvcmllc1RvUXVlcnkgPSBjYXRlZ29yaWVzIHx8IGF2YWlsYWJsZUNhdGVnb3JpZXM7XHJcbiAgICAgICAgY29uc3QgcHJlZmVyZW5jZXM6IGFueSA9IHt9O1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBxdWVyeVByb21pc2VzID0gY2F0ZWdvcmllc1RvUXVlcnkubWFwKGNhdGVnb3J5ID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCBjYXRlZ29yeSwgdW5kZWZpbmVkLCBzY29wZSlcclxuICAgICAgICAgICAgICAgICAgICAudGhlbigoY29uZmlnOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmVyZW5jZXNbY2F0ZWdvcnldID0gY29uZmlnO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2F0ZWdvcnkgZG9lc24ndCBleGlzdCBvciBhY2Nlc3MgZGVuaWVkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZlcmVuY2VzW2NhdGVnb3J5XSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocXVlcnlQcm9taXNlcyk7XHJcblxyXG4gICAgICAgICAgICAvLyBGaWx0ZXIgb3V0IG51bGwgZW50cmllc1xyXG4gICAgICAgICAgICBjb25zdCB2YWxpZFByZWZlcmVuY2VzID0gT2JqZWN0LmZyb21FbnRyaWVzKFxyXG4gICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMocHJlZmVyZW5jZXMpLmZpbHRlcigoW18sIHZhbHVlXSkgPT4gdmFsdWUgIT09IG51bGwpXHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgUmV0cmlldmVkIHByZWZlcmVuY2VzIGZvciAke09iamVjdC5rZXlzKHZhbGlkUHJlZmVyZW5jZXMpLmxlbmd0aH0gY2F0ZWdvcmllc2AsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdGVkQ2F0ZWdvcmllczogY2F0ZWdvcmllc1RvUXVlcnksXHJcbiAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlQ2F0ZWdvcmllczogT2JqZWN0LmtleXModmFsaWRQcmVmZXJlbmNlcyksXHJcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyZW5jZXM6IHZhbGlkUHJlZmVyZW5jZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgc3VtbWFyeToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0b3RhbENhdGVnb3JpZXM6IE9iamVjdC5rZXlzKHZhbGlkUHJlZmVyZW5jZXMpLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGU6IHNjb3BlXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVycm9yIHJldHJpZXZpbmcgcHJlZmVyZW5jZXM6ICR7ZXJyLm1lc3NhZ2V9YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGxpc3RQcmVmZXJlbmNlc0NhdGVnb3JpZXMoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gW1xyXG4gICAgICAgICAgICB7IG5hbWU6ICdnZW5lcmFsJywgZGVzY3JpcHRpb246ICdHZW5lcmFsIGVkaXRvciBzZXR0aW5ncyBhbmQgVUkgcHJlZmVyZW5jZXMnIH0sXHJcbiAgICAgICAgICAgIHsgbmFtZTogJ2V4dGVybmFsLXRvb2xzJywgZGVzY3JpcHRpb246ICdFeHRlcm5hbCB0b29sIGludGVncmF0aW9ucyBhbmQgcGF0aHMnIH0sXHJcbiAgICAgICAgICAgIHsgbmFtZTogJ2RhdGEtZWRpdG9yJywgZGVzY3JpcHRpb246ICdEYXRhIGVkaXRvciBjb25maWd1cmF0aW9ucyBhbmQgdGVtcGxhdGVzJyB9LFxyXG4gICAgICAgICAgICB7IG5hbWU6ICdsYWJvcmF0b3J5JywgZGVzY3JpcHRpb246ICdFeHBlcmltZW50YWwgZmVhdHVyZXMgYW5kIGJldGEgZnVuY3Rpb25hbGl0eScgfSxcclxuICAgICAgICAgICAgeyBuYW1lOiAnZXh0ZW5zaW9ucycsIGRlc2NyaXB0aW9uOiAnRXh0ZW5zaW9uIG1hbmFnZXIgYW5kIHBsdWdpbiBzZXR0aW5ncycgfSxcclxuICAgICAgICAgICAgeyBuYW1lOiAncHJldmlldycsIGRlc2NyaXB0aW9uOiAnR2FtZSBwcmV2aWV3IGFuZCBzaW11bGF0b3Igc2V0dGluZ3MnIH0sXHJcbiAgICAgICAgICAgIHsgbmFtZTogJ2NvbnNvbGUnLCBkZXNjcmlwdGlvbjogJ0NvbnNvbGUgcGFuZWwgZGlzcGxheSBhbmQgbG9nZ2luZyBvcHRpb25zJyB9LFxyXG4gICAgICAgICAgICB7IG5hbWU6ICduYXRpdmUnLCBkZXNjcmlwdGlvbjogJ05hdGl2ZSBwbGF0Zm9ybSBidWlsZCBjb25maWd1cmF0aW9ucycgfSxcclxuICAgICAgICAgICAgeyBuYW1lOiAnYnVpbGRlcicsIGRlc2NyaXB0aW9uOiAnQnVpbGQgc3lzdGVtIGFuZCBjb21waWxhdGlvbiBzZXR0aW5ncycgfVxyXG4gICAgICAgIF07XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgTGlzdGVkICR7Y2F0ZWdvcmllcy5sZW5ndGh9IGF2YWlsYWJsZSBwcmVmZXJlbmNlIGNhdGVnb3JpZXNgLFxyXG4gICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICBjYXRlZ29yaWVzLFxyXG4gICAgICAgICAgICAgICAgdG90YWxDb3VudDogY2F0ZWdvcmllcy5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICB1c2FnZTogJ1VzZSB0aGVzZSBjYXRlZ29yeSBuYW1lcyB3aXRoIHByZWZlcmVuY2VzX21hbmFnZSBvciBwcmVmZXJlbmNlc19xdWVyeSB0b29scydcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZWFyY2hQcmVmZXJlbmNlc1NldHRpbmdzKGtleXdvcmQ6IHN0cmluZywgaW5jbHVkZVZhbHVlczogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIFZhbGlkYXRlIGtleXdvcmQgcGFyYW1ldGVyXHJcbiAgICAgICAgICAgIGlmICgha2V5d29yZCB8fCB0eXBlb2Yga2V5d29yZCAhPT0gJ3N0cmluZycgfHwga2V5d29yZC50cmltKCkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiAnU2VhcmNoIGtleXdvcmQgaXMgcmVxdWlyZWQgYW5kIG11c3QgYmUgYSBub24tZW1wdHkgc3RyaW5nJ1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgdHJpbW1lZEtleXdvcmQgPSBrZXl3b3JkLnRyaW0oKTtcclxuICAgICAgICAgICAgY29uc3QgYWxsUHJlZnNSZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0QWxsUHJlZmVyZW5jZXMoJ2dsb2JhbCcpO1xyXG4gICAgICAgICAgICBpZiAoIWFsbFByZWZzUmVzcG9uc2Uuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFsbFByZWZzUmVzcG9uc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHByZWZlcmVuY2VzID0gYWxsUHJlZnNSZXNwb25zZS5kYXRhPy5wcmVmZXJlbmNlcyB8fCB7fTtcclxuICAgICAgICAgICAgY29uc3Qgc2VhcmNoUmVzdWx0czogYW55W10gPSBbXTtcclxuXHJcbiAgICAgICAgICAgIC8vIFNlYXJjaCB0aHJvdWdoIGFsbCBjYXRlZ29yaWVzIGFuZCB0aGVpciBzZXR0aW5nc1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtjYXRlZ29yeSwgY29uZmlnXSBvZiBPYmplY3QuZW50cmllcyhwcmVmZXJlbmNlcykpIHtcclxuICAgICAgICAgICAgICAgIGlmIChjb25maWcgJiYgdHlwZW9mIGNvbmZpZyA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlYXJjaEluT2JqZWN0KGNvbmZpZyBhcyBhbnksIHRyaW1tZWRLZXl3b3JkLCBjYXRlZ29yeSwgJycsIHNlYXJjaFJlc3VsdHMsIGluY2x1ZGVWYWx1ZXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgRm91bmQgJHtzZWFyY2hSZXN1bHRzLmxlbmd0aH0gc2V0dGluZ3MgbWF0Y2hpbmcgXCIke3RyaW1tZWRLZXl3b3JkfVwiYCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBrZXl3b3JkOiB0cmltbWVkS2V5d29yZCxcclxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlVmFsdWVzLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdENvdW50OiBzZWFyY2hSZXN1bHRzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzOiBzZWFyY2hSZXN1bHRzLnNsaWNlKDAsIDUwKSwgLy8gTGltaXQgcmVzdWx0cyB0byBwcmV2ZW50IG92ZXJ3aGVsbWluZyBvdXRwdXRcclxuICAgICAgICAgICAgICAgICAgICBoYXNNb3JlUmVzdWx0czogc2VhcmNoUmVzdWx0cy5sZW5ndGggPiA1MFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBTZWFyY2ggZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHNlYXJjaEluT2JqZWN0KG9iajogYW55LCBrZXl3b3JkOiBzdHJpbmcsIGNhdGVnb3J5OiBzdHJpbmcsIHBhdGhQcmVmaXg6IHN0cmluZywgcmVzdWx0czogYW55W10sIGluY2x1ZGVWYWx1ZXM6IGJvb2xlYW4pOiB2b2lkIHtcclxuICAgICAgICBpZiAoIW9iaiB8fCB0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAha2V5d29yZCB8fCB0eXBlb2Yga2V5d29yZCAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgbG93ZXJLZXl3b3JkID0ga2V5d29yZC50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKG9iaikpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRQYXRoID0gcGF0aFByZWZpeCA/IGAke3BhdGhQcmVmaXh9LiR7a2V5fWAgOiBrZXk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBrZXlNYXRjaGVzID0ga2V5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXJLZXl3b3JkKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlTWF0Y2hlcyA9IHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhsb3dlcktleXdvcmQpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoa2V5TWF0Y2hlcyB8fCB2YWx1ZU1hdGNoZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGN1cnJlbnRQYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBrZXksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoVHlwZToga2V5TWF0Y2hlcyA/ICh2YWx1ZU1hdGNoZXMgPyAnYm90aCcgOiAna2V5JykgOiAndmFsdWUnXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZVZhbHVlcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQudmFsdWUgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnZhbHVlVHlwZSA9IHR5cGVvZiB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIFJlY3Vyc2l2ZWx5IHNlYXJjaCBuZXN0ZWQgb2JqZWN0cyAod2l0aCBkZXB0aCBsaW1pdCB0byBwcmV2ZW50IGluZmluaXRlIHJlY3Vyc2lvbilcclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHZhbHVlKSAmJiBwYXRoUHJlZml4LnNwbGl0KCcuJykubGVuZ3RoIDwgMTApIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlYXJjaEluT2JqZWN0KHZhbHVlLCBrZXl3b3JkLCBjYXRlZ29yeSwgY3VycmVudFBhdGgsIHJlc3VsdHMsIGluY2x1ZGVWYWx1ZXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgLy8gU2tpcCBvYmplY3RzIHRoYXQgY2FuJ3QgYmUgZW51bWVyYXRlZFxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydFByZWZlcmVuY2VzKGNhdGVnb3JpZXM/OiBzdHJpbmdbXSwgc2NvcGU6IHN0cmluZyA9ICdnbG9iYWwnLCBpbmNsdWRlRGVmYXVsdHM6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gVmFsaWRhdGUgc2NvcGUgcGFyYW1ldGVyXHJcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkU2NvcGVzID0gWydnbG9iYWwnLCAnbG9jYWwnXTtcclxuICAgICAgICAgICAgaWYgKCF2YWxpZFNjb3Blcy5pbmNsdWRlcyhzY29wZSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBJbnZhbGlkIHNjb3BlIFwiJHtzY29wZX1cIi4gTXVzdCBiZSBvbmUgb2Y6ICR7dmFsaWRTY29wZXMuam9pbignLCAnKX1gXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBWYWxpZGF0ZSBjYXRlZ29yaWVzIHBhcmFtZXRlciBpZiBwcm92aWRlZFxyXG4gICAgICAgICAgICBpZiAoY2F0ZWdvcmllcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGNhdGVnb3JpZXMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiAnQ2F0ZWdvcmllcyBtdXN0IGJlIGFuIGFycmF5J1xyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgdmFsaWRDYXRlZ29yaWVzID0gWydnZW5lcmFsJywgJ2V4dGVybmFsLXRvb2xzJywgJ2RhdGEtZWRpdG9yJywgJ2xhYm9yYXRvcnknLCAnZXh0ZW5zaW9ucycsICdwcmV2aWV3JywgJ2NvbnNvbGUnLCAnbmF0aXZlJywgJ2J1aWxkZXInXTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGludmFsaWRDYXRlZ29yaWVzID0gY2F0ZWdvcmllcy5maWx0ZXIoY2F0ID0+ICF2YWxpZENhdGVnb3JpZXMuaW5jbHVkZXMoY2F0KSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoaW52YWxpZENhdGVnb3JpZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYEludmFsaWQgY2F0ZWdvcmllczogJHtpbnZhbGlkQ2F0ZWdvcmllcy5qb2luKCcsICcpfS4gVmFsaWQgY2F0ZWdvcmllcyBhcmU6ICR7dmFsaWRDYXRlZ29yaWVzLmpvaW4oJywgJyl9YFxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGFsbFByZWZzUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldEFsbFByZWZlcmVuY2VzKHNjb3BlLCBjYXRlZ29yaWVzKTtcclxuICAgICAgICAgICAgaWYgKCFhbGxQcmVmc1Jlc3BvbnNlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBhbGxQcmVmc1Jlc3BvbnNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBleHBvcnREYXRhOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICBtZXRhZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGV4cG9ydERhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgICAgICAgICAgICBzY29wZTogc2NvcGUsXHJcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZURlZmF1bHRzOiBpbmNsdWRlRGVmYXVsdHMsXHJcbiAgICAgICAgICAgICAgICAgICAgY29jb3NWZXJzaW9uOiAoRWRpdG9yIGFzIGFueSkudmVyc2lvbnM/LmNvY29zIHx8ICdVbmtub3duJyxcclxuICAgICAgICAgICAgICAgICAgICBleHBvcnRlZENhdGVnb3JpZXM6IE9iamVjdC5rZXlzKGFsbFByZWZzUmVzcG9uc2UuZGF0YT8ucHJlZmVyZW5jZXMgfHwge30pLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3RlZENhdGVnb3JpZXM6IGNhdGVnb3JpZXMgfHwgJ2FsbCdcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBwcmVmZXJlbmNlczogYWxsUHJlZnNSZXNwb25zZS5kYXRhPy5wcmVmZXJlbmNlcyB8fCB7fVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgLy8gSW5jbHVkZSBkZWZhdWx0cyBpZiByZXF1ZXN0ZWRcclxuICAgICAgICAgICAgaWYgKGluY2x1ZGVEZWZhdWx0cykge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWZhdWx0c1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXRBbGxQcmVmZXJlbmNlcygnZGVmYXVsdCcsIGNhdGVnb3JpZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWZhdWx0c1Jlc3BvbnNlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0RGF0YS5kZWZhdWx0cyA9IGRlZmF1bHRzUmVzcG9uc2UuZGF0YT8ucHJlZmVyZW5jZXMgfHwge307XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0RGF0YS5tZXRhZGF0YS5kZWZhdWx0c1dhcm5pbmcgPSAnQ291bGQgbm90IHJldHJpZXZlIGRlZmF1bHQgcHJlZmVyZW5jZXMnO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXhwb3J0RGF0YS5tZXRhZGF0YS5kZWZhdWx0c1dhcm5pbmcgPSAnRXJyb3IgcmV0cmlldmluZyBkZWZhdWx0IHByZWZlcmVuY2VzJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QganNvbkRhdGEgPSBKU09OLnN0cmluZ2lmeShleHBvcnREYXRhLCBudWxsLCAyKTtcclxuICAgICAgICAgICAgY29uc3QgZXhwb3J0UGF0aCA9IGBjb2Nvc19wcmVmZXJlbmNlc18ke3Njb3BlfV8ke0RhdGUubm93KCl9Lmpzb25gO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIFByZWZlcmVuY2VzIGV4cG9ydGVkIGZvciAke2V4cG9ydERhdGEubWV0YWRhdGEuZXhwb3J0ZWRDYXRlZ29yaWVzLmxlbmd0aH0gY2F0ZWdvcmllc2AsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXhwb3J0UGF0aCxcclxuICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YTogZXhwb3J0RGF0YS5tZXRhZGF0YSxcclxuICAgICAgICAgICAgICAgICAgICBwcmVmZXJlbmNlczogZXhwb3J0RGF0YS5wcmVmZXJlbmNlcyxcclxuICAgICAgICAgICAgICAgICAgICBqc29uRGF0YSxcclxuICAgICAgICAgICAgICAgICAgICBmaWxlU2l6ZTogQnVmZmVyLmJ5dGVMZW5ndGgoanNvbkRhdGEsICd1dGY4JyksXHJcbiAgICAgICAgICAgICAgICAgICAgc3VtbWFyeToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0b3RhbENhdGVnb3JpZXM6IGV4cG9ydERhdGEubWV0YWRhdGEuZXhwb3J0ZWRDYXRlZ29yaWVzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGU6IHNjb3BlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmNsdWRlRGVmYXVsdHM6IGluY2x1ZGVEZWZhdWx0cyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzRGVmYXVsdHM6ICEhZXhwb3J0RGF0YS5kZWZhdWx0c1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBgRXhwb3J0IGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUJhY2t1cERhdGEoYmFja3VwRGF0YTogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uID0ge1xyXG4gICAgICAgICAgICAgICAgaXNWYWxpZDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGVycm9yczogW10gYXMgc3RyaW5nW10sXHJcbiAgICAgICAgICAgICAgICB3YXJuaW5nczogW10gYXMgc3RyaW5nW10sXHJcbiAgICAgICAgICAgICAgICBtZXRhZGF0YTogbnVsbCBhcyBhbnlcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGJhY2t1cERhdGEgaXMgcHJvdmlkZWRcclxuICAgICAgICAgICAgaWYgKGJhY2t1cERhdGEgPT09IHVuZGVmaW5lZCB8fCBiYWNrdXBEYXRhID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0aW9uLmlzVmFsaWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHZhbGlkYXRpb24uZXJyb3JzLnB1c2goJ0JhY2t1cCBkYXRhIGlzIHJlcXVpcmVkIGFuZCBjYW5ub3QgYmUgbnVsbCBvciB1bmRlZmluZWQnKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdCYWNrdXAgZGF0YSBpcyByZXF1aXJlZCBmb3IgdmFsaWRhdGlvbidcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIGJhc2ljIHN0cnVjdHVyZVxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGJhY2t1cERhdGEgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoYmFja3VwRGF0YSkpIHtcclxuICAgICAgICAgICAgICAgIHZhbGlkYXRpb24uaXNWYWxpZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvbi5lcnJvcnMucHVzaCgnQmFja3VwIGRhdGEgbXVzdCBiZSBhIHZhbGlkIG9iamVjdCAobm90IGFycmF5IG9yIHByaW1pdGl2ZSB0eXBlKScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIG1ldGFkYXRhXHJcbiAgICAgICAgICAgICAgICBpZiAoYmFja3VwRGF0YS5tZXRhZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYmFja3VwRGF0YS5tZXRhZGF0YSAhPT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi5lcnJvcnMucHVzaCgnTWV0YWRhdGEgbXVzdCBiZSBhbiBvYmplY3QnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi5pc1ZhbGlkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi5tZXRhZGF0YSA9IGJhY2t1cERhdGEubWV0YWRhdGE7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWJhY2t1cERhdGEubWV0YWRhdGEuZXhwb3J0RGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi53YXJuaW5ncy5wdXNoKCdNaXNzaW5nIGV4cG9ydCBkYXRlIGluIG1ldGFkYXRhJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGJhY2t1cERhdGEubWV0YWRhdGEuZXhwb3J0RGF0ZSAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb24ud2FybmluZ3MucHVzaCgnRXhwb3J0IGRhdGUgc2hvdWxkIGJlIGEgc3RyaW5nJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghYmFja3VwRGF0YS5tZXRhZGF0YS5zY29wZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi53YXJuaW5ncy5wdXNoKCdNaXNzaW5nIHNjb3BlIGluZm9ybWF0aW9uIGluIG1ldGFkYXRhJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIVsnZ2xvYmFsJywgJ2xvY2FsJywgJ2RlZmF1bHQnXS5pbmNsdWRlcyhiYWNrdXBEYXRhLm1ldGFkYXRhLnNjb3BlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi53YXJuaW5ncy5wdXNoKCdJbnZhbGlkIHNjb3BlIHZhbHVlIGluIG1ldGFkYXRhJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiYWNrdXBEYXRhLm1ldGFkYXRhLmNvY29zVmVyc2lvbiAmJiB0eXBlb2YgYmFja3VwRGF0YS5tZXRhZGF0YS5jb2Nvc1ZlcnNpb24gIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uLndhcm5pbmdzLnB1c2goJ0NvY29zIHZlcnNpb24gc2hvdWxkIGJlIGEgc3RyaW5nJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb24ud2FybmluZ3MucHVzaCgnTm8gbWV0YWRhdGEgZm91bmQgaW4gYmFja3VwIGZpbGUnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgcHJlZmVyZW5jZXMgZGF0YVxyXG4gICAgICAgICAgICAgICAgaWYgKCFiYWNrdXBEYXRhLnByZWZlcmVuY2VzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi5lcnJvcnMucHVzaCgnTm8gcHJlZmVyZW5jZXMgZGF0YSBmb3VuZCBpbiBiYWNrdXAnKTtcclxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uLmlzVmFsaWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGJhY2t1cERhdGEucHJlZmVyZW5jZXMgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoYmFja3VwRGF0YS5wcmVmZXJlbmNlcykpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uLmVycm9ycy5wdXNoKCdQcmVmZXJlbmNlcyBkYXRhIG11c3QgYmUgYW4gb2JqZWN0IChub3QgYXJyYXkgb3IgcHJpbWl0aXZlIHR5cGUpJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi5pc1ZhbGlkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIENvdW50IGNhdGVnb3JpZXMgYW5kIHZhbGlkYXRlIHN0cnVjdHVyZVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5Q291bnQgPSBPYmplY3Qua2V5cyhiYWNrdXBEYXRhLnByZWZlcmVuY2VzKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhdGVnb3J5Q291bnQgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi53YXJuaW5ncy5wdXNoKCdCYWNrdXAgY29udGFpbnMgbm8gcHJlZmVyZW5jZSBjYXRlZ29yaWVzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBWYWxpZGF0ZSBjYXRlZ29yeSBuYW1lc1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkQ2F0ZWdvcmllcyA9IFsnZ2VuZXJhbCcsICdleHRlcm5hbC10b29scycsICdkYXRhLWVkaXRvcicsICdsYWJvcmF0b3J5JywgJ2V4dGVuc2lvbnMnLCAncHJldmlldycsICdjb25zb2xlJywgJ25hdGl2ZScsICdidWlsZGVyJ107XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52YWxpZENhdGVnb3JpZXMgPSBPYmplY3Qua2V5cyhiYWNrdXBEYXRhLnByZWZlcmVuY2VzKS5maWx0ZXIoY2F0ID0+ICF2YWxpZENhdGVnb3JpZXMuaW5jbHVkZXMoY2F0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGludmFsaWRDYXRlZ29yaWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbi53YXJuaW5ncy5wdXNoKGBVbmtub3duIGNhdGVnb3JpZXMgZm91bmQ6ICR7aW52YWxpZENhdGVnb3JpZXMuam9pbignLCAnKX1gKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBCYWNrdXAgdmFsaWRhdGlvbiBjb21wbGV0ZWQ6ICR7dmFsaWRhdGlvbi5pc1ZhbGlkID8gJ1ZhbGlkJyA6ICdJbnZhbGlkJ31gLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGlzVmFsaWQ6IHZhbGlkYXRpb24uaXNWYWxpZCxcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcnM6IHZhbGlkYXRpb24uZXJyb3JzLFxyXG4gICAgICAgICAgICAgICAgICAgIHdhcm5pbmdzOiB2YWxpZGF0aW9uLndhcm5pbmdzLFxyXG4gICAgICAgICAgICAgICAgICAgIG1ldGFkYXRhOiB2YWxpZGF0aW9uLm1ldGFkYXRhLFxyXG4gICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzRXJyb3JzOiB2YWxpZGF0aW9uLmVycm9ycy5sZW5ndGggPiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBoYXNXYXJuaW5nczogdmFsaWRhdGlvbi53YXJuaW5ncy5sZW5ndGggPiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeUNvdW50OiBiYWNrdXBEYXRhPy5wcmVmZXJlbmNlcyA/IE9iamVjdC5rZXlzKGJhY2t1cERhdGEucHJlZmVyZW5jZXMpLmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yQ291bnQ6IHZhbGlkYXRpb24uZXJyb3JzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ0NvdW50OiB2YWxpZGF0aW9uLndhcm5pbmdzLmxlbmd0aFxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBgVmFsaWRhdGlvbiBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59Il19