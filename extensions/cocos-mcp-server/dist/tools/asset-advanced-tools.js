"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetAdvancedTools = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class AssetAdvancedTools {
    getTools() {
        return [
            {
                name: 'asset_manage',
                description: 'ASSET MANAGEMENT: Import, delete, save metadata, or generate URLs for assets. Use this for all asset creation/deletion/modification operations. WORKFLOW: First use asset_query to find assets, then perform operations. Import requires sourcePath+targetUrl, delete needs urls array, save_meta needs urlOrUUID+content, generate_url needs url parameter.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['import', 'delete', 'save_meta', 'generate_url'],
                            description: 'Choose operation: "import" = batch import external files into project (requires assets array) | "delete" = batch remove assets from project (requires urls array) | "save_meta" = update asset metadata (requires urlOrUUID+content) | "generate_url" = create unique URL for asset (requires url)'
                        },
                        // For import action
                        assets: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    sourcePath: { type: 'string', description: 'Source file path' },
                                    targetUrl: { type: 'string', description: 'Target asset URL' }
                                },
                                required: ['sourcePath', 'targetUrl']
                            },
                            description: 'Array of import operations (REQUIRED for import action). Each item must have sourcePath (external file) and targetUrl (destination in project). Example: [{"sourcePath":"/path/to/image.png", "targetUrl":"db://assets/images/hero.png"}]'
                        },
                        overwrite: {
                            type: 'boolean',
                            description: 'Whether to overwrite existing assets (import action only)',
                            default: false
                        },
                        // For delete action
                        urls: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of asset URLs to remove (REQUIRED for delete action). Use Cocos asset URLs like "db://assets/images/hero.png". Get URLs from asset_query tool first. Example: ["db://assets/images/old1.png", "db://assets/scenes/test.scene"]'
                        },
                        // For save_meta action
                        urlOrUUID: {
                            type: 'string',
                            description: 'Asset identifier (REQUIRED for save_meta action). Can be asset URL like "db://assets/image.png" or UUID like "12345678-abcd-1234-5678-123456789abc". Get from asset_query tool.'
                        },
                        content: {
                            type: 'string',
                            description: 'Serialized metadata content (REQUIRED for save_meta action). Must be valid JSON string containing asset metadata. Format depends on asset type. Example: "{\"importer\":\"image\",\"settings\":{\"format\":\"png\"}}"'
                        },
                        // For generate_url action
                        url: {
                            type: 'string',
                            description: 'Asset URL to generate available URL for (generate_url action only)'
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'asset_analyze',
                description: 'ASSET ANALYSIS: Get dependencies or export manifests. Use this to understand asset relationships and generate project reports. WORKFLOW: Use dependencies to trace asset usage, use manifest to export inventory. LIMITATIONS: Reference validation and unused asset detection are disabled due to API constraints.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['dependencies', 'manifest'],
                            description: 'Analysis type: "dependencies" = trace which assets this asset depends on (requires url parameter) | "manifest" = generate complete asset inventory report for folder (optional folder parameter, outputs JSON/CSV/XML format)'
                        },
                        // Common parameters
                        folder: {
                            type: 'string',
                            description: 'Target folder path to analyze (both actions). Default: "db://assets" analyzes entire project. Examples: "db://assets/scenes" for scenes only, "db://assets/textures" for textures only.',
                            default: 'db://assets'
                        },
                        // For dependencies action
                        url: {
                            type: 'string',
                            description: 'Asset URL to analyze dependencies for (REQUIRED for dependencies action). Must be valid Cocos asset URL like "db://assets/scenes/Game.scene" or "db://assets/prefabs/Player.prefab". Get URL from asset_query tool first.'
                        },
                        deep: {
                            type: 'boolean',
                            description: 'Include indirect dependencies (dependencies action only). true = show all nested dependencies recursively, false = show only direct dependencies. Recommended: true for complete analysis.',
                            default: true
                        },
                        // For unused action
                        includeSubfolders: {
                            type: 'boolean',
                            description: 'Whether to include subfolders (unused action only)',
                            default: true
                        },
                        // For manifest action
                        format: {
                            type: 'string',
                            description: 'Output format for manifest (manifest action only). "json" = structured data for APIs, "csv" = spreadsheet compatible, "xml" = legacy system integration.',
                            enum: ['json', 'csv', 'xml'],
                            default: 'json'
                        },
                        includeMetadata: {
                            type: 'boolean',
                            description: 'Include detailed metadata in manifest (manifest action only). true = full asset information including import settings, false = basic info only (name, path, type, UUID). Note: Currently limited by API availability.',
                            default: false
                        }
                    },
                    required: ['action']
                }
            },
            // COMMENTED OUT: asset_optimize - Texture compression requires image processing APIs not available in Cocos Creator MCP
            /*
            {
                name: 'asset_optimize',
                description: 'ASSET OPTIMIZATION: Compress textures and optimize assets for better performance. DISABLED - No image processing APIs available.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['compress_textures'],
                            description: 'Action: "compress_textures" = batch compress texture assets'
                        }
                    },
                    required: ['action']
                }
            },
            */
            {
                name: 'asset_system',
                description: 'ASSET SYSTEM: Check asset database status, refresh assets, or open assets with external programs. Use this for system-level asset operations.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['check_ready', 'open_external', 'refresh'],
                            description: 'Action: "check_ready" = check if asset database is ready | "open_external" = open asset with external program | "refresh" = refresh asset database'
                        },
                        url: {
                            type: 'string',
                            description: 'Asset URL to open (open_external action only)'
                        },
                        folder: {
                            type: 'string',
                            description: 'Specific folder to refresh (refresh action only)'
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'asset_query',
                description: 'ASSET QUERY: Search, get information, and find assets by various criteria. Use this for asset discovery and detailed information retrieval.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['get_info', 'get_assets', 'find_by_name', 'get_details', 'query_path', 'query_uuid', 'query_url'],
                            description: 'Query action to perform'
                        },
                        // For get_info action
                        assetPath: {
                            type: 'string',
                            description: 'Asset path (get_info/get_details actions only)'
                        },
                        // For get_assets action
                        type: {
                            type: 'string',
                            enum: ['all', 'scene', 'prefab', 'script', 'texture', 'material', 'mesh', 'audio', 'animation', 'effect', 'chunk'],
                            description: 'Asset type filter (get_assets action only). Supports Cocos built-in types like effect and chunk.',
                            default: 'all'
                        },
                        folder: {
                            type: 'string',
                            description: 'Search scope (get_assets/find_by_name actions). Options: "db://assets" = user assets only, "db://internal" = built-in assets only, "all" = both user and built-in assets. Default searches both user and built-in.',
                            default: 'db://assets'
                        },
                        // For find_by_name action
                        name: {
                            type: 'string',
                            description: 'Asset name to search for (find_by_name action only)'
                        },
                        exactMatch: {
                            type: 'boolean',
                            description: 'Whether to use exact name matching (find_by_name action only)',
                            default: false
                        },
                        assetType: {
                            type: 'string',
                            enum: ['all', 'scene', 'prefab', 'script', 'texture', 'material', 'mesh', 'audio', 'animation', 'spriteFrame'],
                            description: 'Filter by asset type (find_by_name action only)',
                            default: 'all'
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of results (find_by_name action only)',
                            default: 20
                        },
                        // For get_details action
                        includeSubAssets: {
                            type: 'boolean',
                            description: 'Include sub-assets like spriteFrame (get_details action only)',
                            default: true
                        },
                        // For query actions
                        url: {
                            type: 'string',
                            description: 'Asset URL (query_path/query_uuid actions only)'
                        },
                        uuid: {
                            type: 'string',
                            description: 'Asset UUID (query_url action only)'
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'asset_operations',
                description: 'ASSET OPERATIONS: Create, copy, move, delete, save, and import assets. Use this for all asset file operations and modifications.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['create', 'copy', 'move', 'delete', 'save', 'reimport', 'import'],
                            description: 'Asset operation to perform'
                        },
                        // For create action
                        url: {
                            type: 'string',
                            description: 'Asset URL (create/delete/save/reimport actions)'
                        },
                        content: {
                            type: 'string',
                            description: 'File content - null for folder (create/save actions)'
                        },
                        overwrite: {
                            type: 'boolean',
                            description: 'Overwrite existing file (create/copy/move actions)',
                            default: false
                        },
                        // For copy/move actions
                        source: {
                            type: 'string',
                            description: 'Source asset URL (copy/move actions)'
                        },
                        target: {
                            type: 'string',
                            description: 'Target location URL (copy/move actions)'
                        },
                        // For import action
                        sourcePath: {
                            type: 'string',
                            description: 'Source file path (import action only)'
                        },
                        targetFolder: {
                            type: 'string',
                            description: 'Target folder in assets (import action only)'
                        }
                    },
                    required: ['action']
                }
            }
        ];
    }
    async execute(toolName, args) {
        switch (toolName) {
            case 'asset_manage':
                return await this.handleAssetManage(args);
            case 'asset_analyze':
                return await this.handleAssetAnalyze(args);
            case 'asset_system':
                return await this.handleAssetSystem(args);
            case 'asset_query':
                return await this.handleAssetQuery(args);
            case 'asset_operations':
                return await this.handleAssetOperations(args);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    // 新的整合处理函数
    async handleAssetManage(args) {
        const { action } = args;
        switch (action) {
            case 'import':
                return await this.batchImportAssets(args.assets, args.overwrite);
            case 'delete':
                return await this.batchDeleteAssets(args.urls);
            case 'save_meta':
                return await this.saveAssetMeta(args.urlOrUUID, args.content);
            case 'generate_url':
                return await this.generateAvailableUrl(args.url);
            default:
                return { success: false, error: `Unknown asset manage action: ${action}` };
        }
    }
    async handleAssetAnalyze(args) {
        const { action } = args;
        switch (action) {
            // case 'validate_refs': // COMMENTED OUT - Requires complex project analysis
            //     return await this.validateAssetReferences(args.folder);
            case 'dependencies':
                return await this.getAssetDependencies(args.url, args.deep);
            // case 'unused': // COMMENTED OUT - Requires complex project analysis
            //     return await this.getUnusedAssets(args.folder, args.includeSubfolders);
            case 'manifest':
                return await this.exportAssetManifest(args.folder, args.format, args.includeMetadata);
            default:
                return { success: false, error: `Unknown asset analyze action: ${action}` };
        }
    }
    // COMMENTED OUT - No image processing APIs available in Cocos Creator MCP
    /*
    private async handleAssetOptimize(args: any): Promise<ToolResponse> {
        const { action } = args;
        
        switch (action) {
            case 'compress_textures':
                return await this.compressTextures(args.folder, args.quality, args.format, args.recursive);
            default:
                return { success: false, error: `Unknown asset optimize action: ${action}` };
        }
    }
    */
    async handleAssetSystem(args) {
        const { action } = args;
        switch (action) {
            case 'check_ready':
                return await this.queryAssetDbReady();
            case 'open_external':
                return await this.openAssetExternal(args.url);
            case 'refresh':
                return await this.refreshAssets(args.folder);
            default:
                return { success: false, error: `Unknown asset system action: ${action}` };
        }
    }
    async handleAssetQuery(args) {
        const { action } = args;
        switch (action) {
            case 'get_info':
                return await this.getAssetInfo(args.assetPath);
            case 'get_assets':
                return await this.getAssets(args.type, args.folder);
            case 'find_by_name':
                return await this.findAssetByName(args);
            case 'get_details':
                return await this.getAssetDetails(args.assetPath, args.includeSubAssets);
            case 'query_path':
                return await this.queryAssetPath(args.url);
            case 'query_uuid':
                return await this.queryAssetUuid(args.url);
            case 'query_url':
                return await this.queryAssetUrl(args.uuid);
            default:
                return { success: false, error: `Unknown asset query action: ${action}` };
        }
    }
    async handleAssetOperations(args) {
        const { action } = args;
        switch (action) {
            case 'create':
                return await this.createAsset(args.url, args.content, args.overwrite);
            case 'copy':
                return await this.copyAsset(args.source, args.target, args.overwrite);
            case 'move':
                return await this.moveAsset(args.source, args.target, args.overwrite);
            case 'delete':
                return await this.deleteAsset(args.url);
            case 'save':
                return await this.saveAsset(args.url, args.content);
            case 'reimport':
                return await this.reimportAsset(args.url);
            case 'import':
                return await this.importAsset(args.sourcePath, args.targetFolder);
            default:
                return { success: false, error: `Unknown asset operation action: ${action}` };
        }
    }
    // 原有的实现方法保持不变（从原文件复制）
    async saveAssetMeta(urlOrUUID, content) {
        try {
            const result = await Editor.Message.request('asset-db', 'save-asset-meta', urlOrUUID, content);
            return {
                success: true,
                message: `✅ Asset meta saved successfully`,
                data: { urlOrUUID, result }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to save asset meta: ${error.message}`
            };
        }
    }
    async generateAvailableUrl(url) {
        try {
            const availableUrl = await Editor.Message.request('asset-db', 'generate-available-url', url);
            return {
                success: true,
                message: `✅ Available URL generated`,
                data: { originalUrl: url, availableUrl }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to generate available URL: ${error.message}`
            };
        }
    }
    async queryAssetDbReady() {
        try {
            const isReady = await Editor.Message.request('asset-db', 'query-ready');
            return {
                success: true,
                message: `✅ Asset database status: ${isReady ? 'Ready' : 'Not Ready'}`,
                data: { ready: isReady }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to check asset database status: ${error.message}`
            };
        }
    }
    async openAssetExternal(url) {
        try {
            const result = await Editor.Message.request('asset-db', 'open-asset-external', url);
            return {
                success: true,
                message: `✅ Asset opened externally`,
                data: { url, result }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to open asset externally: ${error.message}`
            };
        }
    }
    async batchImportAssets(assets, overwrite = false) {
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const asset of assets) {
            try {
                const result = await Editor.Message.request('asset-db', 'create-asset', asset.targetUrl, {
                    source: asset.sourcePath,
                    rename: !(overwrite || false)
                });
                results.push({
                    sourcePath: asset.sourcePath,
                    targetUrl: asset.targetUrl,
                    success: true,
                    result
                });
                successCount++;
            }
            catch (error) {
                results.push({
                    sourcePath: asset.sourcePath,
                    targetUrl: asset.targetUrl,
                    success: false,
                    error: error.message
                });
                errorCount++;
            }
        }
        return {
            success: errorCount === 0,
            message: `✅ Imported ${successCount}/${assets.length} assets`,
            data: {
                totalRequested: assets.length,
                successCount,
                errorCount,
                results
            }
        };
    }
    async batchDeleteAssets(urls) {
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        for (const url of urls) {
            try {
                const result = await Editor.Message.request('asset-db', 'delete-asset', url);
                results.push({
                    url,
                    success: true,
                    result
                });
                successCount++;
            }
            catch (error) {
                results.push({
                    url,
                    success: false,
                    error: error.message
                });
                errorCount++;
            }
        }
        return {
            success: errorCount === 0,
            message: `✅ Deleted ${successCount}/${urls.length} assets`,
            data: {
                totalRequested: urls.length,
                successCount,
                errorCount,
                results
            }
        };
    }
    // COMMENTED OUT - Requires complex project analysis not available in current Cocos Creator MCP APIs
    /*
    private async validateAssetReferences(folder: string = 'db://assets'): Promise<ToolResponse> {
        return {
            success: false,
            error: 'Asset reference validation requires complex project analysis not available in current Cocos Creator MCP implementation.'
        };
    }
    */
    async getAssetDependencies(url, deep = true) {
        try {
            const dependencies = await Editor.Message.request('asset-db', 'query-asset-dependencies', url, deep);
            return {
                success: true,
                message: `✅ Asset dependencies retrieved`,
                data: {
                    url,
                    deep,
                    dependencies,
                    count: Array.isArray(dependencies) ? dependencies.length : 0
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to get asset dependencies: ${error.message}`
            };
        }
    }
    // COMMENTED OUT - Requires comprehensive project analysis not available in current Cocos Creator MCP APIs
    /*
    private async getUnusedAssets(folder: string = 'db://assets', includeSubfolders: boolean = true): Promise<ToolResponse> {
        return {
            success: false,
            error: 'Unused asset detection requires comprehensive project analysis not available in current Cocos Creator MCP implementation.'
        };
    }
    */
    // COMMENTED OUT - Texture compression requires image processing APIs not available in Cocos Creator MCP
    /*
    private async compressTextures(folder: string = 'db://assets', quality: number = 80, format: string = 'jpg', recursive: boolean = true): Promise<ToolResponse> {
        return {
            success: false,
            error: 'Texture compression requires image processing capabilities not available in current Cocos Creator MCP implementation.'
        };
    }
    */
    async exportAssetManifest(folder = 'db://assets', format = 'json', _includeMetadata = false) {
        try {
            // 获取实际的资源数据
            const allAssetsResponse = await Editor.Message.request('asset-db', 'query-assets');
            const allAssets = Array.isArray(allAssetsResponse) ? allAssetsResponse : [];
            // 过滤指定文件夹的资源
            const filteredAssets = allAssets.filter(asset => asset.path && asset.path.includes(folder));
            // 构建资源清单 - 只包含基础信息，不包含模拟的元数据
            const assets = filteredAssets.map(asset => {
                return {
                    name: asset.name,
                    path: asset.path,
                    type: asset.type,
                    uuid: asset.uuid
                    // NOTE: includeMetadata parameter ignored - detailed metadata requires APIs not available in current MCP
                };
            });
            const manifest = {
                folder,
                format,
                includeMetadata: false, // Always false - metadata APIs not available
                assets,
                exportDate: new Date().toISOString(),
                totalAssets: assets.length,
                summary: {
                    byType: this.groupAssetsByType(assets)
                    // NOTE: totalSize calculation removed - requires file system APIs not available in MCP
                }
            };
            return {
                success: true,
                message: `✅ Asset manifest exported with ${assets.length} assets`,
                data: manifest
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to export asset manifest: ${error.message}`
            };
        }
    }
    groupAssetsByType(assets) {
        const grouped = {};
        assets.forEach(asset => {
            const type = asset.type || 'Unknown';
            grouped[type] = (grouped[type] || 0) + 1;
        });
        return grouped;
    }
    // New asset operation methods moved from project-tools.ts
    async refreshAssets(folder) {
        const targetPath = folder || 'db://assets';
        try {
            await Editor.Message.request('asset-db', 'refresh-asset', targetPath);
            return {
                success: true,
                message: `✅ Assets refreshed in: ${targetPath}`,
                data: { folder: targetPath }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async importAsset(sourcePath, targetFolder) {
        if (!fs.existsSync(sourcePath)) {
            return { success: false, error: 'Source file not found' };
        }
        const fileName = path.basename(sourcePath);
        const targetPath = targetFolder.startsWith('db://') ?
            targetFolder : `db://assets/${targetFolder}`;
        try {
            const result = await Editor.Message.request('asset-db', 'import-asset', sourcePath, `${targetPath}/${fileName}`);
            return {
                success: true,
                message: `✅ Asset imported: ${fileName}`,
                data: {
                    uuid: result.uuid,
                    path: result.url,
                    fileName
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async getAssetInfo(assetPath) {
        try {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', assetPath);
            if (!assetInfo) {
                return { success: false, error: 'Asset not found' };
            }
            const info = {
                name: assetInfo.name,
                uuid: assetInfo.uuid,
                path: assetInfo.url,
                type: assetInfo.type,
                size: assetInfo.size,
                isDirectory: assetInfo.isDirectory
            };
            if (assetInfo.meta) {
                info.meta = {
                    ver: assetInfo.meta.ver,
                    importer: assetInfo.meta.importer
                };
            }
            return {
                success: true,
                message: `✅ Asset info retrieved: ${info.name}`,
                data: info
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async getAssets(type = 'all', folder = 'db://assets') {
        try {
            let patterns = [];
            // 决定搜索范围
            if (folder === 'all') {
                // 搜索用户资源和内置资源
                patterns = ['db://assets/**/*', 'db://internal/**/*'];
            }
            else if (folder === 'db://internal') {
                // 只搜索内置资源
                patterns = ['db://internal/**/*'];
            }
            else if (folder === 'db://assets') {
                // 只搜索用户资源
                patterns = ['db://assets/**/*'];
            }
            else {
                // 指定文件夹
                patterns = [`${folder}/**/*`];
            }
            // 如果指定了类型，添加扩展名过滤
            if (type !== 'all') {
                const typeExtensions = {
                    'scene': '.scene',
                    'prefab': '.prefab',
                    'script': '.{ts,js}',
                    'texture': '.{png,jpg,jpeg,gif,tga,bmp,psd}',
                    'material': '.mtl',
                    'mesh': '.{fbx,obj,dae}',
                    'audio': '.{mp3,ogg,wav,m4a}',
                    'animation': '.{anim,clip}',
                    'effect': '.effect',
                    'chunk': '.chunk'
                };
                const extension = typeExtensions[type];
                if (extension) {
                    patterns = patterns.map(pattern => pattern.replace('/**/*', `/**/*${extension}`));
                }
            }
            console.log(`[DEBUG] Searching assets with patterns:`, patterns);
            // 并行查询所有模式
            const allResults = await Promise.all(patterns.map(pattern => Editor.Message.request('asset-db', 'query-assets', { pattern: pattern })
                .catch((err) => {
                console.log(`[DEBUG] Pattern ${pattern} failed:`, err);
                return [];
            })));
            // 合并结果并去重
            const combinedResults = allResults.flat();
            const uniqueAssets = new Map();
            combinedResults.forEach(asset => {
                if (asset && asset.uuid && !uniqueAssets.has(asset.uuid)) {
                    uniqueAssets.set(asset.uuid, {
                        name: asset.name,
                        uuid: asset.uuid,
                        path: asset.url,
                        type: asset.type,
                        size: asset.size || 0,
                        isDirectory: asset.isDirectory || false,
                        isBuiltIn: asset.url.startsWith('db://internal')
                    });
                }
            });
            const assets = Array.from(uniqueAssets.values());
            // 按类型分组统计
            const userAssets = assets.filter(a => !a.isBuiltIn);
            const builtInAssets = assets.filter(a => a.isBuiltIn);
            return {
                success: true,
                message: `✅ Found ${assets.length} assets (${userAssets.length} user + ${builtInAssets.length} built-in) of type '${type}'`,
                data: {
                    type: type,
                    folder: folder,
                    count: assets.length,
                    userCount: userAssets.length,
                    builtInCount: builtInAssets.length,
                    assets: assets
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async createAsset(url, content = null, overwrite = false) {
        const options = {
            overwrite: overwrite,
            rename: !overwrite
        };
        try {
            const result = await Editor.Message.request('asset-db', 'create-asset', url, content, options);
            const assetType = content === null ? 'Folder' : 'File';
            return {
                success: true,
                message: `✅ ${assetType} created successfully`,
                data: {
                    uuid: result === null || result === void 0 ? void 0 : result.uuid,
                    url: (result === null || result === void 0 ? void 0 : result.url) || url,
                    type: assetType.toLowerCase()
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async copyAsset(source, target, overwrite = false) {
        const options = {
            overwrite: overwrite,
            rename: !overwrite
        };
        try {
            const result = await Editor.Message.request('asset-db', 'copy-asset', source, target, options);
            return {
                success: true,
                message: `✅ Asset copied successfully`,
                data: {
                    uuid: result === null || result === void 0 ? void 0 : result.uuid,
                    source: source,
                    target: (result === null || result === void 0 ? void 0 : result.url) || target
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async moveAsset(source, target, overwrite = false) {
        const options = {
            overwrite: overwrite,
            rename: !overwrite
        };
        try {
            const result = await Editor.Message.request('asset-db', 'move-asset', source, target, options);
            return {
                success: true,
                message: `✅ Asset moved successfully`,
                data: {
                    uuid: result === null || result === void 0 ? void 0 : result.uuid,
                    source: source,
                    target: (result === null || result === void 0 ? void 0 : result.url) || target
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async deleteAsset(url) {
        try {
            await Editor.Message.request('asset-db', 'delete-asset', url);
            return {
                success: true,
                message: `✅ Asset deleted successfully`,
                data: { url }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async saveAsset(url, content) {
        try {
            const result = await Editor.Message.request('asset-db', 'save-asset', url, content);
            return {
                success: true,
                message: `✅ Asset saved successfully`,
                data: {
                    uuid: result === null || result === void 0 ? void 0 : result.uuid,
                    url: (result === null || result === void 0 ? void 0 : result.url) || url
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async reimportAsset(url) {
        try {
            await Editor.Message.request('asset-db', 'reimport-asset', url);
            return {
                success: true,
                message: `✅ Asset reimported successfully`,
                data: { url }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryAssetPath(url) {
        try {
            const assetPath = await Editor.Message.request('asset-db', 'query-path', url);
            if (assetPath) {
                return {
                    success: true,
                    message: `✅ Asset path retrieved`,
                    data: { url, path: assetPath }
                };
            }
            else {
                return { success: false, error: 'Asset path not found' };
            }
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryAssetUuid(url) {
        try {
            const uuid = await Editor.Message.request('asset-db', 'query-uuid', url);
            if (uuid) {
                return {
                    success: true,
                    message: `✅ Asset UUID retrieved`,
                    data: { url, uuid }
                };
            }
            else {
                return { success: false, error: 'Asset UUID not found' };
            }
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryAssetUrl(uuid) {
        try {
            const url = await Editor.Message.request('asset-db', 'query-url', uuid);
            if (url) {
                return {
                    success: true,
                    message: `✅ Asset URL retrieved`,
                    data: { uuid, url }
                };
            }
            else {
                return { success: false, error: 'Asset URL not found' };
            }
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async findAssetByName(args) {
        const { name, exactMatch = false, assetType = 'all', folder = 'db://assets', maxResults = 20 } = args;
        try {
            const allAssetsResponse = await this.getAssets(assetType, folder);
            if (!allAssetsResponse.success || !allAssetsResponse.data) {
                return {
                    success: false,
                    error: `Failed to get assets: ${allAssetsResponse.error}`
                };
            }
            const allAssets = allAssetsResponse.data.assets;
            let matchedAssets = [];
            for (const asset of allAssets) {
                const assetName = asset.name;
                let matches = false;
                if (exactMatch) {
                    matches = assetName === name;
                }
                else {
                    matches = assetName.toLowerCase().includes(name.toLowerCase());
                }
                if (matches) {
                    try {
                        const detailResponse = await this.getAssetInfo(asset.path);
                        if (detailResponse.success) {
                            matchedAssets.push(Object.assign(Object.assign({}, asset), { details: detailResponse.data }));
                        }
                        else {
                            matchedAssets.push(asset);
                        }
                    }
                    catch (_a) {
                        matchedAssets.push(asset);
                    }
                    if (matchedAssets.length >= maxResults) {
                        break;
                    }
                }
            }
            return {
                success: true,
                message: `✅ Found ${matchedAssets.length} assets matching '${name}'`,
                data: {
                    searchTerm: name,
                    exactMatch,
                    assetType,
                    folder,
                    totalFound: matchedAssets.length,
                    maxResults,
                    assets: matchedAssets
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Asset search failed: ${error.message}`
            };
        }
    }
    async getAssetDetails(assetPath, includeSubAssets = true) {
        try {
            const assetInfoResponse = await this.getAssetInfo(assetPath);
            if (!assetInfoResponse.success) {
                return assetInfoResponse;
            }
            const assetInfo = assetInfoResponse.data;
            const detailedInfo = Object.assign(Object.assign({}, assetInfo), { subAssets: [] });
            if (includeSubAssets && assetInfo) {
                if (assetInfo.type === 'cc.ImageAsset' || assetPath.match(/\.(png|jpg|jpeg|gif|tga|bmp|psd)$/i)) {
                    const baseUuid = assetInfo.uuid;
                    const possibleSubAssets = [
                        { type: 'spriteFrame', uuid: `${baseUuid}@f9941`, suffix: '@f9941' },
                        { type: 'texture', uuid: `${baseUuid}@6c48a`, suffix: '@6c48a' },
                        { type: 'texture2D', uuid: `${baseUuid}@6c48a`, suffix: '@6c48a' }
                    ];
                    for (const subAsset of possibleSubAssets) {
                        try {
                            const subAssetUrl = await Editor.Message.request('asset-db', 'query-url', subAsset.uuid);
                            if (subAssetUrl) {
                                detailedInfo.subAssets.push({
                                    type: subAsset.type,
                                    uuid: subAsset.uuid,
                                    url: subAssetUrl,
                                    suffix: subAsset.suffix
                                });
                            }
                        }
                        catch (_a) {
                            // Sub-asset doesn't exist, skip it
                        }
                    }
                }
            }
            return {
                success: true,
                message: `✅ Asset details retrieved. Found ${detailedInfo.subAssets.length} sub-assets`,
                data: Object.assign({ assetPath,
                    includeSubAssets }, detailedInfo)
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to get asset details: ${error.message}`
            };
        }
    }
}
exports.AssetAdvancedTools = AssetAdvancedTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtYWR2YW5jZWQtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvYXNzZXQtYWR2YW5jZWQtdG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3QixNQUFhLGtCQUFrQjtJQUMzQixRQUFRO1FBQ0osT0FBTztZQUNIO2dCQUNJLElBQUksRUFBRSxjQUFjO2dCQUNwQixXQUFXLEVBQUUsOFZBQThWO2dCQUMzVyxXQUFXLEVBQUU7b0JBQ1QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLE1BQU0sRUFBRTs0QkFDSixJQUFJLEVBQUUsUUFBUTs0QkFDZCxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxjQUFjLENBQUM7NEJBQ3ZELFdBQVcsRUFBRSxvU0FBb1M7eUJBQ3BUO3dCQUNELG9CQUFvQjt3QkFDcEIsTUFBTSxFQUFFOzRCQUNKLElBQUksRUFBRSxPQUFPOzRCQUNiLEtBQUssRUFBRTtnQ0FDSCxJQUFJLEVBQUUsUUFBUTtnQ0FDZCxVQUFVLEVBQUU7b0NBQ1IsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsa0JBQWtCLEVBQUU7b0NBQy9ELFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFFO2lDQUNqRTtnQ0FDRCxRQUFRLEVBQUUsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDOzZCQUN4Qzs0QkFDRCxXQUFXLEVBQUUsMk9BQTJPO3lCQUMzUDt3QkFDRCxTQUFTLEVBQUU7NEJBQ1AsSUFBSSxFQUFFLFNBQVM7NEJBQ2YsV0FBVyxFQUFFLDJEQUEyRDs0QkFDeEUsT0FBTyxFQUFFLEtBQUs7eUJBQ2pCO3dCQUNELG9CQUFvQjt3QkFDcEIs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QUMsTUFBTTtpQ0FDMUIsQ0FBQyxDQUFDOzRCQUNQLENBQUM7d0JBQ0wsQ0FBQzt3QkFBQyxXQUFNLENBQUM7NEJBQ0wsbUNBQW1DO3dCQUN2QyxDQUFDO29CQUNMLENBQUM7Z0JBQ0wsQ0FBQztZQUNMLENBQUM7WUFFRCxPQUFPO2dCQUNILE9BQU8sRUFBRSxJQUFJO2dCQUNiLE9BQU8sRUFBRSxvQ0FBb0MsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLGFBQWE7Z0JBQ3ZGLElBQUksa0JBQ0EsU0FBUztvQkFDVCxnQkFBZ0IsSUFDYixZQUFZLENBQ2xCO2FBQ0osQ0FBQztRQUVOLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU87Z0JBQ0gsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLGdDQUFnQyxLQUFLLENBQUMsT0FBTyxFQUFFO2FBQ3pELENBQUM7UUFDTixDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBdGtDRCxnREFza0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVG9vbERlZmluaXRpb24sIFRvb2xSZXNwb25zZSwgVG9vbEV4ZWN1dG9yLCBBc3NldEluZm8gfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmV4cG9ydCBjbGFzcyBBc3NldEFkdmFuY2VkVG9vbHMgaW1wbGVtZW50cyBUb29sRXhlY3V0b3Ige1xyXG4gICAgZ2V0VG9vbHMoKTogVG9vbERlZmluaXRpb25bXSB7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2Fzc2V0X21hbmFnZScsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FTU0VUIE1BTkFHRU1FTlQ6IEltcG9ydCwgZGVsZXRlLCBzYXZlIG1ldGFkYXRhLCBvciBnZW5lcmF0ZSBVUkxzIGZvciBhc3NldHMuIFVzZSB0aGlzIGZvciBhbGwgYXNzZXQgY3JlYXRpb24vZGVsZXRpb24vbW9kaWZpY2F0aW9uIG9wZXJhdGlvbnMuIFdPUktGTE9XOiBGaXJzdCB1c2UgYXNzZXRfcXVlcnkgdG8gZmluZCBhc3NldHMsIHRoZW4gcGVyZm9ybSBvcGVyYXRpb25zLiBJbXBvcnQgcmVxdWlyZXMgc291cmNlUGF0aCt0YXJnZXRVcmwsIGRlbGV0ZSBuZWVkcyB1cmxzIGFycmF5LCBzYXZlX21ldGEgbmVlZHMgdXJsT3JVVUlEK2NvbnRlbnQsIGdlbmVyYXRlX3VybCBuZWVkcyB1cmwgcGFyYW1ldGVyLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnaW1wb3J0JywgJ2RlbGV0ZScsICdzYXZlX21ldGEnLCAnZ2VuZXJhdGVfdXJsJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Nob29zZSBvcGVyYXRpb246IFwiaW1wb3J0XCIgPSBiYXRjaCBpbXBvcnQgZXh0ZXJuYWwgZmlsZXMgaW50byBwcm9qZWN0IChyZXF1aXJlcyBhc3NldHMgYXJyYXkpIHwgXCJkZWxldGVcIiA9IGJhdGNoIHJlbW92ZSBhc3NldHMgZnJvbSBwcm9qZWN0IChyZXF1aXJlcyB1cmxzIGFycmF5KSB8IFwic2F2ZV9tZXRhXCIgPSB1cGRhdGUgYXNzZXQgbWV0YWRhdGEgKHJlcXVpcmVzIHVybE9yVVVJRCtjb250ZW50KSB8IFwiZ2VuZXJhdGVfdXJsXCIgPSBjcmVhdGUgdW5pcXVlIFVSTCBmb3IgYXNzZXQgKHJlcXVpcmVzIHVybCknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBpbXBvcnQgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0czoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBmaWxlIHBhdGgnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgYXNzZXQgVVJMJyB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydzb3VyY2VQYXRoJywgJ3RhcmdldFVybCddXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBcnJheSBvZiBpbXBvcnQgb3BlcmF0aW9ucyAoUkVRVUlSRUQgZm9yIGltcG9ydCBhY3Rpb24pLiBFYWNoIGl0ZW0gbXVzdCBoYXZlIHNvdXJjZVBhdGggKGV4dGVybmFsIGZpbGUpIGFuZCB0YXJnZXRVcmwgKGRlc3RpbmF0aW9uIGluIHByb2plY3QpLiBFeGFtcGxlOiBbe1wic291cmNlUGF0aFwiOlwiL3BhdGgvdG8vaW1hZ2UucG5nXCIsIFwidGFyZ2V0VXJsXCI6XCJkYjovL2Fzc2V0cy9pbWFnZXMvaGVyby5wbmdcIn1dJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdmVyd3JpdGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciB0byBvdmVyd3JpdGUgZXhpc3RpbmcgYXNzZXRzIChpbXBvcnQgYWN0aW9uIG9ubHkpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBkZWxldGUgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBcnJheSBvZiBhc3NldCBVUkxzIHRvIHJlbW92ZSAoUkVRVUlSRUQgZm9yIGRlbGV0ZSBhY3Rpb24pLiBVc2UgQ29jb3MgYXNzZXQgVVJMcyBsaWtlIFwiZGI6Ly9hc3NldHMvaW1hZ2VzL2hlcm8ucG5nXCIuIEdldCBVUkxzIGZyb20gYXNzZXRfcXVlcnkgdG9vbCBmaXJzdC4gRXhhbXBsZTogW1wiZGI6Ly9hc3NldHMvaW1hZ2VzL29sZDEucG5nXCIsIFwiZGI6Ly9hc3NldHMvc2NlbmVzL3Rlc3Quc2NlbmVcIl0nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBzYXZlX21ldGEgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybE9yVVVJRDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IGlkZW50aWZpZXIgKFJFUVVJUkVEIGZvciBzYXZlX21ldGEgYWN0aW9uKS4gQ2FuIGJlIGFzc2V0IFVSTCBsaWtlIFwiZGI6Ly9hc3NldHMvaW1hZ2UucG5nXCIgb3IgVVVJRCBsaWtlIFwiMTIzNDU2NzgtYWJjZC0xMjM0LTU2NzgtMTIzNDU2Nzg5YWJjXCIuIEdldCBmcm9tIGFzc2V0X3F1ZXJ5IHRvb2wuJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2VyaWFsaXplZCBtZXRhZGF0YSBjb250ZW50IChSRVFVSVJFRCBmb3Igc2F2ZV9tZXRhIGFjdGlvbikuIE11c3QgYmUgdmFsaWQgSlNPTiBzdHJpbmcgY29udGFpbmluZyBhc3NldCBtZXRhZGF0YS4gRm9ybWF0IGRlcGVuZHMgb24gYXNzZXQgdHlwZS4gRXhhbXBsZTogXCJ7XFxcImltcG9ydGVyXFxcIjpcXFwiaW1hZ2VcXFwiLFxcXCJzZXR0aW5nc1xcXCI6e1xcXCJmb3JtYXRcXFwiOlxcXCJwbmdcXFwifX1cIidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIGdlbmVyYXRlX3VybCBhY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQXNzZXQgVVJMIHRvIGdlbmVyYXRlIGF2YWlsYWJsZSBVUkwgZm9yIChnZW5lcmF0ZV91cmwgYWN0aW9uIG9ubHkpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnYXNzZXRfYW5hbHl6ZScsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FTU0VUIEFOQUxZU0lTOiBHZXQgZGVwZW5kZW5jaWVzIG9yIGV4cG9ydCBtYW5pZmVzdHMuIFVzZSB0aGlzIHRvIHVuZGVyc3RhbmQgYXNzZXQgcmVsYXRpb25zaGlwcyBhbmQgZ2VuZXJhdGUgcHJvamVjdCByZXBvcnRzLiBXT1JLRkxPVzogVXNlIGRlcGVuZGVuY2llcyB0byB0cmFjZSBhc3NldCB1c2FnZSwgdXNlIG1hbmlmZXN0IHRvIGV4cG9ydCBpbnZlbnRvcnkuIExJTUlUQVRJT05TOiBSZWZlcmVuY2UgdmFsaWRhdGlvbiBhbmQgdW51c2VkIGFzc2V0IGRldGVjdGlvbiBhcmUgZGlzYWJsZWQgZHVlIHRvIEFQSSBjb25zdHJhaW50cy4nLFxyXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlcGVuZGVuY2llcycsICdtYW5pZmVzdCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBbmFseXNpcyB0eXBlOiBcImRlcGVuZGVuY2llc1wiID0gdHJhY2Ugd2hpY2ggYXNzZXRzIHRoaXMgYXNzZXQgZGVwZW5kcyBvbiAocmVxdWlyZXMgdXJsIHBhcmFtZXRlcikgfCBcIm1hbmlmZXN0XCIgPSBnZW5lcmF0ZSBjb21wbGV0ZSBhc3NldCBpbnZlbnRvcnkgcmVwb3J0IGZvciBmb2xkZXIgKG9wdGlvbmFsIGZvbGRlciBwYXJhbWV0ZXIsIG91dHB1dHMgSlNPTi9DU1YvWE1MIGZvcm1hdCknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbW1vbiBwYXJhbWV0ZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbGRlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RhcmdldCBmb2xkZXIgcGF0aCB0byBhbmFseXplIChib3RoIGFjdGlvbnMpLiBEZWZhdWx0OiBcImRiOi8vYXNzZXRzXCIgYW5hbHl6ZXMgZW50aXJlIHByb2plY3QuIEV4YW1wbGVzOiBcImRiOi8vYXNzZXRzL3NjZW5lc1wiIGZvciBzY2VuZXMgb25seSwgXCJkYjovL2Fzc2V0cy90ZXh0dXJlc1wiIGZvciB0ZXh0dXJlcyBvbmx5LicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBkZXBlbmRlbmNpZXMgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVSTCB0byBhbmFseXplIGRlcGVuZGVuY2llcyBmb3IgKFJFUVVJUkVEIGZvciBkZXBlbmRlbmNpZXMgYWN0aW9uKS4gTXVzdCBiZSB2YWxpZCBDb2NvcyBhc3NldCBVUkwgbGlrZSBcImRiOi8vYXNzZXRzL3NjZW5lcy9HYW1lLnNjZW5lXCIgb3IgXCJkYjovL2Fzc2V0cy9wcmVmYWJzL1BsYXllci5wcmVmYWJcIi4gR2V0IFVSTCBmcm9tIGFzc2V0X3F1ZXJ5IHRvb2wgZmlyc3QuJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWVwOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luY2x1ZGUgaW5kaXJlY3QgZGVwZW5kZW5jaWVzIChkZXBlbmRlbmNpZXMgYWN0aW9uIG9ubHkpLiB0cnVlID0gc2hvdyBhbGwgbmVzdGVkIGRlcGVuZGVuY2llcyByZWN1cnNpdmVseSwgZmFsc2UgPSBzaG93IG9ubHkgZGlyZWN0IGRlcGVuZGVuY2llcy4gUmVjb21tZW5kZWQ6IHRydWUgZm9yIGNvbXBsZXRlIGFuYWx5c2lzLicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciB1bnVzZWQgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVTdWJmb2xkZXJzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1doZXRoZXIgdG8gaW5jbHVkZSBzdWJmb2xkZXJzICh1bnVzZWQgYWN0aW9uIG9ubHkpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIG1hbmlmZXN0IGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXQ6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdPdXRwdXQgZm9ybWF0IGZvciBtYW5pZmVzdCAobWFuaWZlc3QgYWN0aW9uIG9ubHkpLiBcImpzb25cIiA9IHN0cnVjdHVyZWQgZGF0YSBmb3IgQVBJcywgXCJjc3ZcIiA9IHNwcmVhZHNoZWV0IGNvbXBhdGlibGUsIFwieG1sXCIgPSBsZWdhY3kgc3lzdGVtIGludGVncmF0aW9uLicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2pzb24nLCAnY3N2JywgJ3htbCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogJ2pzb24nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVNZXRhZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbmNsdWRlIGRldGFpbGVkIG1ldGFkYXRhIGluIG1hbmlmZXN0IChtYW5pZmVzdCBhY3Rpb24gb25seSkuIHRydWUgPSBmdWxsIGFzc2V0IGluZm9ybWF0aW9uIGluY2x1ZGluZyBpbXBvcnQgc2V0dGluZ3MsIGZhbHNlID0gYmFzaWMgaW5mbyBvbmx5IChuYW1lLCBwYXRoLCB0eXBlLCBVVUlEKS4gTm90ZTogQ3VycmVudGx5IGxpbWl0ZWQgYnkgQVBJIGF2YWlsYWJpbGl0eS4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gQ09NTUVOVEVEIE9VVDogYXNzZXRfb3B0aW1pemUgLSBUZXh0dXJlIGNvbXByZXNzaW9uIHJlcXVpcmVzIGltYWdlIHByb2Nlc3NpbmcgQVBJcyBub3QgYXZhaWxhYmxlIGluIENvY29zIENyZWF0b3IgTUNQXHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldF9vcHRpbWl6ZScsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FTU0VUIE9QVElNSVpBVElPTjogQ29tcHJlc3MgdGV4dHVyZXMgYW5kIG9wdGltaXplIGFzc2V0cyBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlLiBESVNBQkxFRCAtIE5vIGltYWdlIHByb2Nlc3NpbmcgQVBJcyBhdmFpbGFibGUuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydjb21wcmVzc190ZXh0dXJlcyddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IFwiY29tcHJlc3NfdGV4dHVyZXNcIiA9IGJhdGNoIGNvbXByZXNzIHRleHR1cmUgYXNzZXRzJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnYXNzZXRfc3lzdGVtJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQVNTRVQgU1lTVEVNOiBDaGVjayBhc3NldCBkYXRhYmFzZSBzdGF0dXMsIHJlZnJlc2ggYXNzZXRzLCBvciBvcGVuIGFzc2V0cyB3aXRoIGV4dGVybmFsIHByb2dyYW1zLiBVc2UgdGhpcyBmb3Igc3lzdGVtLWxldmVsIGFzc2V0IG9wZXJhdGlvbnMuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydjaGVja19yZWFkeScsICdvcGVuX2V4dGVybmFsJywgJ3JlZnJlc2gnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBcImNoZWNrX3JlYWR5XCIgPSBjaGVjayBpZiBhc3NldCBkYXRhYmFzZSBpcyByZWFkeSB8IFwib3Blbl9leHRlcm5hbFwiID0gb3BlbiBhc3NldCB3aXRoIGV4dGVybmFsIHByb2dyYW0gfCBcInJlZnJlc2hcIiA9IHJlZnJlc2ggYXNzZXQgZGF0YWJhc2UnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVSTCB0byBvcGVuIChvcGVuX2V4dGVybmFsIGFjdGlvbiBvbmx5KSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9sZGVyOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3BlY2lmaWMgZm9sZGVyIHRvIHJlZnJlc2ggKHJlZnJlc2ggYWN0aW9uIG9ubHkpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnYXNzZXRfcXVlcnknLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBU1NFVCBRVUVSWTogU2VhcmNoLCBnZXQgaW5mb3JtYXRpb24sIGFuZCBmaW5kIGFzc2V0cyBieSB2YXJpb3VzIGNyaXRlcmlhLiBVc2UgdGhpcyBmb3IgYXNzZXQgZGlzY292ZXJ5IGFuZCBkZXRhaWxlZCBpbmZvcm1hdGlvbiByZXRyaWV2YWwuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydnZXRfaW5mbycsICdnZXRfYXNzZXRzJywgJ2ZpbmRfYnlfbmFtZScsICdnZXRfZGV0YWlscycsICdxdWVyeV9wYXRoJywgJ3F1ZXJ5X3V1aWQnLCAncXVlcnlfdXJsJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1F1ZXJ5IGFjdGlvbiB0byBwZXJmb3JtJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3IgZ2V0X2luZm8gYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0UGF0aDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IHBhdGggKGdldF9pbmZvL2dldF9kZXRhaWxzIGFjdGlvbnMgb25seSknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBnZXRfYXNzZXRzIGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnYWxsJywgJ3NjZW5lJywgJ3ByZWZhYicsICdzY3JpcHQnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdtZXNoJywgJ2F1ZGlvJywgJ2FuaW1hdGlvbicsICdlZmZlY3QnLCAnY2h1bmsnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQXNzZXQgdHlwZSBmaWx0ZXIgKGdldF9hc3NldHMgYWN0aW9uIG9ubHkpLiBTdXBwb3J0cyBDb2NvcyBidWlsdC1pbiB0eXBlcyBsaWtlIGVmZmVjdCBhbmQgY2h1bmsuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbGRlcjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NlYXJjaCBzY29wZSAoZ2V0X2Fzc2V0cy9maW5kX2J5X25hbWUgYWN0aW9ucykuIE9wdGlvbnM6IFwiZGI6Ly9hc3NldHNcIiA9IHVzZXIgYXNzZXRzIG9ubHksIFwiZGI6Ly9pbnRlcm5hbFwiID0gYnVpbHQtaW4gYXNzZXRzIG9ubHksIFwiYWxsXCIgPSBib3RoIHVzZXIgYW5kIGJ1aWx0LWluIGFzc2V0cy4gRGVmYXVsdCBzZWFyY2hlcyBib3RoIHVzZXIgYW5kIGJ1aWx0LWluLicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBmaW5kX2J5X25hbWUgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCBuYW1lIHRvIHNlYXJjaCBmb3IgKGZpbmRfYnlfbmFtZSBhY3Rpb24gb25seSknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4YWN0TWF0Y2g6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciB0byB1c2UgZXhhY3QgbmFtZSBtYXRjaGluZyAoZmluZF9ieV9uYW1lIGFjdGlvbiBvbmx5KScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFR5cGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnc2NlbmUnLCAncHJlZmFiJywgJ3NjcmlwdCcsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ21lc2gnLCAnYXVkaW8nLCAnYW5pbWF0aW9uJywgJ3Nwcml0ZUZyYW1lJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZpbHRlciBieSBhc3NldCB0eXBlIChmaW5kX2J5X25hbWUgYWN0aW9uIG9ubHkpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1heFJlc3VsdHM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdNYXhpbXVtIG51bWJlciBvZiByZXN1bHRzIChmaW5kX2J5X25hbWUgYWN0aW9uIG9ubHkpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDIwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBnZXRfZGV0YWlscyBhY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgaW5jbHVkZVN1YkFzc2V0czoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbmNsdWRlIHN1Yi1hc3NldHMgbGlrZSBzcHJpdGVGcmFtZSAoZ2V0X2RldGFpbHMgYWN0aW9uIG9ubHkpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHF1ZXJ5IGFjdGlvbnNcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQXNzZXQgVVJMIChxdWVyeV9wYXRoL3F1ZXJ5X3V1aWQgYWN0aW9ucyBvbmx5KSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVVSUQgKHF1ZXJ5X3VybCBhY3Rpb24gb25seSknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldF9vcGVyYXRpb25zJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQVNTRVQgT1BFUkFUSU9OUzogQ3JlYXRlLCBjb3B5LCBtb3ZlLCBkZWxldGUsIHNhdmUsIGFuZCBpbXBvcnQgYXNzZXRzLiBVc2UgdGhpcyBmb3IgYWxsIGFzc2V0IGZpbGUgb3BlcmF0aW9ucyBhbmQgbW9kaWZpY2F0aW9ucy4nLFxyXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2NyZWF0ZScsICdjb3B5JywgJ21vdmUnLCAnZGVsZXRlJywgJ3NhdmUnLCAncmVpbXBvcnQnLCAnaW1wb3J0J10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IG9wZXJhdGlvbiB0byBwZXJmb3JtJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3IgY3JlYXRlIGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCBVUkwgKGNyZWF0ZS9kZWxldGUvc2F2ZS9yZWltcG9ydCBhY3Rpb25zKSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZpbGUgY29udGVudCAtIG51bGwgZm9yIGZvbGRlciAoY3JlYXRlL3NhdmUgYWN0aW9ucyknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJ3cml0ZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdPdmVyd3JpdGUgZXhpc3RpbmcgZmlsZSAoY3JlYXRlL2NvcHkvbW92ZSBhY3Rpb25zKScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3IgY29weS9tb3ZlIGFjdGlvbnNcclxuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU291cmNlIGFzc2V0IFVSTCAoY29weS9tb3ZlIGFjdGlvbnMpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgbG9jYXRpb24gVVJMIChjb3B5L21vdmUgYWN0aW9ucyknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBpbXBvcnQgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGg6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTb3VyY2UgZmlsZSBwYXRoIChpbXBvcnQgYWN0aW9uIG9ubHkpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRGb2xkZXI6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgZm9sZGVyIGluIGFzc2V0cyAoaW1wb3J0IGFjdGlvbiBvbmx5KSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZXhlY3V0ZSh0b29sTmFtZTogc3RyaW5nLCBhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHN3aXRjaCAodG9vbE5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSAnYXNzZXRfbWFuYWdlJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUFzc2V0TWFuYWdlKGFyZ3MpO1xyXG4gICAgICAgICAgICBjYXNlICdhc3NldF9hbmFseXplJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUFzc2V0QW5hbHl6ZShhcmdzKTtcclxuICAgICAgICAgICAgY2FzZSAnYXNzZXRfc3lzdGVtJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUFzc2V0U3lzdGVtKGFyZ3MpO1xyXG4gICAgICAgICAgICBjYXNlICdhc3NldF9xdWVyeSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5oYW5kbGVBc3NldFF1ZXJ5KGFyZ3MpO1xyXG4gICAgICAgICAgICBjYXNlICdhc3NldF9vcGVyYXRpb25zJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUFzc2V0T3BlcmF0aW9ucyhhcmdzKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0b29sOiAke3Rvb2xOYW1lfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyDmlrDnmoTmlbTlkIjlpITnkIblh73mlbBcclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlQXNzZXRNYW5hZ2UoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdpbXBvcnQnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuYmF0Y2hJbXBvcnRBc3NldHMoYXJncy5hc3NldHMsIGFyZ3Mub3ZlcndyaXRlKTtcclxuICAgICAgICAgICAgY2FzZSAnZGVsZXRlJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmJhdGNoRGVsZXRlQXNzZXRzKGFyZ3MudXJscyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NhdmVfbWV0YSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zYXZlQXNzZXRNZXRhKGFyZ3MudXJsT3JVVUlELCBhcmdzLmNvbnRlbnQpO1xyXG4gICAgICAgICAgICBjYXNlICdnZW5lcmF0ZV91cmwnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2VuZXJhdGVBdmFpbGFibGVVcmwoYXJncy51cmwpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBhc3NldCBtYW5hZ2UgYWN0aW9uOiAke2FjdGlvbn1gIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlQXNzZXRBbmFseXplKGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24gfSA9IGFyZ3M7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgLy8gY2FzZSAndmFsaWRhdGVfcmVmcyc6IC8vIENPTU1FTlRFRCBPVVQgLSBSZXF1aXJlcyBjb21wbGV4IHByb2plY3QgYW5hbHlzaXNcclxuICAgICAgICAgICAgLy8gICAgIHJldHVybiBhd2FpdCB0aGlzLnZhbGlkYXRlQXNzZXRSZWZlcmVuY2VzKGFyZ3MuZm9sZGVyKTtcclxuICAgICAgICAgICAgY2FzZSAnZGVwZW5kZW5jaWVzJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldEFzc2V0RGVwZW5kZW5jaWVzKGFyZ3MudXJsLCBhcmdzLmRlZXApO1xyXG4gICAgICAgICAgICAvLyBjYXNlICd1bnVzZWQnOiAvLyBDT01NRU5URUQgT1VUIC0gUmVxdWlyZXMgY29tcGxleCBwcm9qZWN0IGFuYWx5c2lzXHJcbiAgICAgICAgICAgIC8vICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXRVbnVzZWRBc3NldHMoYXJncy5mb2xkZXIsIGFyZ3MuaW5jbHVkZVN1YmZvbGRlcnMpO1xyXG4gICAgICAgICAgICBjYXNlICdtYW5pZmVzdCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5leHBvcnRBc3NldE1hbmlmZXN0KGFyZ3MuZm9sZGVyLCBhcmdzLmZvcm1hdCwgYXJncy5pbmNsdWRlTWV0YWRhdGEpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBhc3NldCBhbmFseXplIGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBDT01NRU5URUQgT1VUIC0gTm8gaW1hZ2UgcHJvY2Vzc2luZyBBUElzIGF2YWlsYWJsZSBpbiBDb2NvcyBDcmVhdG9yIE1DUFxyXG4gICAgLypcclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlQXNzZXRPcHRpbWl6ZShhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHsgYWN0aW9uIH0gPSBhcmdzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaCAoYWN0aW9uKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ2NvbXByZXNzX3RleHR1cmVzJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvbXByZXNzVGV4dHVyZXMoYXJncy5mb2xkZXIsIGFyZ3MucXVhbGl0eSwgYXJncy5mb3JtYXQsIGFyZ3MucmVjdXJzaXZlKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFVua25vd24gYXNzZXQgb3B0aW1pemUgYWN0aW9uOiAke2FjdGlvbn1gIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgKi9cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUFzc2V0U3lzdGVtKGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24gfSA9IGFyZ3M7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnY2hlY2tfcmVhZHknOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlBc3NldERiUmVhZHkoKTtcclxuICAgICAgICAgICAgY2FzZSAnb3Blbl9leHRlcm5hbCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5vcGVuQXNzZXRFeHRlcm5hbChhcmdzLnVybCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3JlZnJlc2gnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucmVmcmVzaEFzc2V0cyhhcmdzLmZvbGRlcik7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGFzc2V0IHN5c3RlbSBhY3Rpb246ICR7YWN0aW9ufWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVBc3NldFF1ZXJ5KGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24gfSA9IGFyZ3M7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnZ2V0X2luZm8nOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0QXNzZXRJbmZvKGFyZ3MuYXNzZXRQYXRoKTtcclxuICAgICAgICAgICAgY2FzZSAnZ2V0X2Fzc2V0cyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXRBc3NldHMoYXJncy50eXBlLCBhcmdzLmZvbGRlcik7XHJcbiAgICAgICAgICAgIGNhc2UgJ2ZpbmRfYnlfbmFtZSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5maW5kQXNzZXRCeU5hbWUoYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2dldF9kZXRhaWxzJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldEFzc2V0RGV0YWlscyhhcmdzLmFzc2V0UGF0aCwgYXJncy5pbmNsdWRlU3ViQXNzZXRzKTtcclxuICAgICAgICAgICAgY2FzZSAncXVlcnlfcGF0aCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5xdWVyeUFzc2V0UGF0aChhcmdzLnVybCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3F1ZXJ5X3V1aWQnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlBc3NldFV1aWQoYXJncy51cmwpO1xyXG4gICAgICAgICAgICBjYXNlICdxdWVyeV91cmwnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlBc3NldFVybChhcmdzLnV1aWQpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBhc3NldCBxdWVyeSBhY3Rpb246ICR7YWN0aW9ufWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVBc3NldE9wZXJhdGlvbnMoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdjcmVhdGUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY3JlYXRlQXNzZXQoYXJncy51cmwsIGFyZ3MuY29udGVudCwgYXJncy5vdmVyd3JpdGUpO1xyXG4gICAgICAgICAgICBjYXNlICdjb3B5JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNvcHlBc3NldChhcmdzLnNvdXJjZSwgYXJncy50YXJnZXQsIGFyZ3Mub3ZlcndyaXRlKTtcclxuICAgICAgICAgICAgY2FzZSAnbW92ZSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5tb3ZlQXNzZXQoYXJncy5zb3VyY2UsIGFyZ3MudGFyZ2V0LCBhcmdzLm92ZXJ3cml0ZSk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5kZWxldGVBc3NldChhcmdzLnVybCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NhdmUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuc2F2ZUFzc2V0KGFyZ3MudXJsLCBhcmdzLmNvbnRlbnQpO1xyXG4gICAgICAgICAgICBjYXNlICdyZWltcG9ydCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5yZWltcG9ydEFzc2V0KGFyZ3MudXJsKTtcclxuICAgICAgICAgICAgY2FzZSAnaW1wb3J0JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmltcG9ydEFzc2V0KGFyZ3Muc291cmNlUGF0aCwgYXJncy50YXJnZXRGb2xkZXIpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBhc3NldCBvcGVyYXRpb24gYWN0aW9uOiAke2FjdGlvbn1gIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIOWOn+acieeahOWunueOsOaWueazleS/neaMgeS4jeWPmO+8iOS7juWOn+aWh+S7tuWkjeWItu+8iVxyXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXRNZXRhKHVybE9yVVVJRDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQtbWV0YScsIHVybE9yVVVJRCwgY29udGVudCk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBBc3NldCBtZXRhIHNhdmVkIHN1Y2Nlc3NmdWxseWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7IHVybE9yVVVJRCwgcmVzdWx0IH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBzYXZlIGFzc2V0IG1ldGE6ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUF2YWlsYWJsZVVybCh1cmw6IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVXJsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZ2VuZXJhdGUtYXZhaWxhYmxlLXVybCcsIHVybCk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBBdmFpbGFibGUgVVJMIGdlbmVyYXRlZGAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG9yaWdpbmFsVXJsOiB1cmwsIGF2YWlsYWJsZVVybCB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gZ2VuZXJhdGUgYXZhaWxhYmxlIFVSTDogJHsoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXREYlJlYWR5KCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgaXNSZWFkeSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXJlYWR5Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBBc3NldCBkYXRhYmFzZSBzdGF0dXM6ICR7aXNSZWFkeSA/ICdSZWFkeScgOiAnTm90IFJlYWR5J31gLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogeyByZWFkeTogaXNSZWFkeSB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gY2hlY2sgYXNzZXQgZGF0YWJhc2Ugc3RhdHVzOiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkFzc2V0RXh0ZXJuYWwodXJsOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQtZXh0ZXJuYWwnLCB1cmwpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgQXNzZXQgb3BlbmVkIGV4dGVybmFsbHlgLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogeyB1cmwsIHJlc3VsdCB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gb3BlbiBhc3NldCBleHRlcm5hbGx5OiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgYmF0Y2hJbXBvcnRBc3NldHMoYXNzZXRzOiBBcnJheTx7IHNvdXJjZVBhdGg6IHN0cmluZzsgdGFyZ2V0VXJsOiBzdHJpbmcgfT4sIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCByZXN1bHRzOiBhbnlbXSA9IFtdO1xyXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnQgPSAwO1xyXG4gICAgICAgIGxldCBlcnJvckNvdW50ID0gMDtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGFzc2V0LnRhcmdldFVybCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZTogYXNzZXQuc291cmNlUGF0aCxcclxuICAgICAgICAgICAgICAgICAgICByZW5hbWU6ICEob3ZlcndyaXRlIHx8IGZhbHNlKVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgc291cmNlUGF0aDogYXNzZXQuc291cmNlUGF0aCxcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRVcmw6IGFzc2V0LnRhcmdldFVybCxcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQrKztcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgc291cmNlUGF0aDogYXNzZXQuc291cmNlUGF0aCxcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRVcmw6IGFzc2V0LnRhcmdldFVybCxcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGVycm9yQ291bnQrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc3VjY2VzczogZXJyb3JDb3VudCA9PT0gMCxcclxuICAgICAgICAgICAgbWVzc2FnZTogYOKchSBJbXBvcnRlZCAke3N1Y2Nlc3NDb3VudH0vJHthc3NldHMubGVuZ3RofSBhc3NldHNgLFxyXG4gICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICB0b3RhbFJlcXVlc3RlZDogYXNzZXRzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudCxcclxuICAgICAgICAgICAgICAgIGVycm9yQ291bnQsXHJcbiAgICAgICAgICAgICAgICByZXN1bHRzXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgYmF0Y2hEZWxldGVBc3NldHModXJsczogc3RyaW5nW10pOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdHM6IGFueVtdID0gW107XHJcbiAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XHJcbiAgICAgICAgbGV0IGVycm9yQ291bnQgPSAwO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHVybCBvZiB1cmxzKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdkZWxldGUtYXNzZXQnLCB1cmwpO1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICB1cmwsXHJcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHRcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgc3VjY2Vzc0NvdW50Kys7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIHVybCxcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGVycm9yQ291bnQrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc3VjY2VzczogZXJyb3JDb3VudCA9PT0gMCxcclxuICAgICAgICAgICAgbWVzc2FnZTogYOKchSBEZWxldGVkICR7c3VjY2Vzc0NvdW50fS8ke3VybHMubGVuZ3RofSBhc3NldHNgLFxyXG4gICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICB0b3RhbFJlcXVlc3RlZDogdXJscy5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQsXHJcbiAgICAgICAgICAgICAgICBlcnJvckNvdW50LFxyXG4gICAgICAgICAgICAgICAgcmVzdWx0c1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDT01NRU5URUQgT1VUIC0gUmVxdWlyZXMgY29tcGxleCBwcm9qZWN0IGFuYWx5c2lzIG5vdCBhdmFpbGFibGUgaW4gY3VycmVudCBDb2NvcyBDcmVhdG9yIE1DUCBBUElzXHJcbiAgICAvKlxyXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUFzc2V0UmVmZXJlbmNlcyhmb2xkZXI6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICBlcnJvcjogJ0Fzc2V0IHJlZmVyZW5jZSB2YWxpZGF0aW9uIHJlcXVpcmVzIGNvbXBsZXggcHJvamVjdCBhbmFseXNpcyBub3QgYXZhaWxhYmxlIGluIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb24uJ1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICAqL1xyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXREZXBlbmRlbmNpZXModXJsOiBzdHJpbmcsIGRlZXA6IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbmNpZXMgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLCB1cmwsIGRlZXApO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgQXNzZXQgZGVwZW5kZW5jaWVzIHJldHJpZXZlZGAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXJsLFxyXG4gICAgICAgICAgICAgICAgICAgIGRlZXAsXHJcbiAgICAgICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiBBcnJheS5pc0FycmF5KGRlcGVuZGVuY2llcykgPyBkZXBlbmRlbmNpZXMubGVuZ3RoIDogMFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBgRmFpbGVkIHRvIGdldCBhc3NldCBkZXBlbmRlbmNpZXM6ICR7KGVycm9yIGFzIEVycm9yKS5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ09NTUVOVEVEIE9VVCAtIFJlcXVpcmVzIGNvbXByZWhlbnNpdmUgcHJvamVjdCBhbmFseXNpcyBub3QgYXZhaWxhYmxlIGluIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgQVBJc1xyXG4gICAgLypcclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0VW51c2VkQXNzZXRzKGZvbGRlcjogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJywgaW5jbHVkZVN1YmZvbGRlcnM6IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgZXJyb3I6ICdVbnVzZWQgYXNzZXQgZGV0ZWN0aW9uIHJlcXVpcmVzIGNvbXByZWhlbnNpdmUgcHJvamVjdCBhbmFseXNpcyBub3QgYXZhaWxhYmxlIGluIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb24uJ1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcbiAgICAqL1xyXG5cclxuICAgIC8vIENPTU1FTlRFRCBPVVQgLSBUZXh0dXJlIGNvbXByZXNzaW9uIHJlcXVpcmVzIGltYWdlIHByb2Nlc3NpbmcgQVBJcyBub3QgYXZhaWxhYmxlIGluIENvY29zIENyZWF0b3IgTUNQXHJcbiAgICAvKlxyXG4gICAgcHJpdmF0ZSBhc3luYyBjb21wcmVzc1RleHR1cmVzKGZvbGRlcjogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJywgcXVhbGl0eTogbnVtYmVyID0gODAsIGZvcm1hdDogc3RyaW5nID0gJ2pwZycsIHJlY3Vyc2l2ZTogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICBlcnJvcjogJ1RleHR1cmUgY29tcHJlc3Npb24gcmVxdWlyZXMgaW1hZ2UgcHJvY2Vzc2luZyBjYXBhYmlsaXRpZXMgbm90IGF2YWlsYWJsZSBpbiBjdXJyZW50IENvY29zIENyZWF0b3IgTUNQIGltcGxlbWVudGF0aW9uLidcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgKi9cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydEFzc2V0TWFuaWZlc3QoZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnLCBmb3JtYXQ6IHN0cmluZyA9ICdqc29uJywgX2luY2x1ZGVNZXRhZGF0YTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyDojrflj5blrp7pmYXnmoTotYTmupDmlbDmja5cclxuICAgICAgICAgICAgY29uc3QgYWxsQXNzZXRzUmVzcG9uc2UgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnKTtcclxuICAgICAgICAgICAgY29uc3QgYWxsQXNzZXRzID0gQXJyYXkuaXNBcnJheShhbGxBc3NldHNSZXNwb25zZSkgPyBhbGxBc3NldHNSZXNwb25zZSA6IFtdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8g6L+H5ruk5oyH5a6a5paH5Lu25aS555qE6LWE5rqQXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlcmVkQXNzZXRzID0gYWxsQXNzZXRzLmZpbHRlcihhc3NldCA9PiBcclxuICAgICAgICAgICAgICAgIGFzc2V0LnBhdGggJiYgYXNzZXQucGF0aC5pbmNsdWRlcyhmb2xkZXIpXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyDmnoTlu7rotYTmupDmuIXljZUgLSDlj6rljIXlkKvln7rnoYDkv6Hmga/vvIzkuI3ljIXlkKvmqKHmi5/nmoTlhYPmlbDmja5cclxuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gZmlsdGVyZWRBc3NldHMubWFwKGFzc2V0ID0+IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBhc3NldC5wYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGFzc2V0LnR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogYXNzZXQudXVpZFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IGluY2x1ZGVNZXRhZGF0YSBwYXJhbWV0ZXIgaWdub3JlZCAtIGRldGFpbGVkIG1ldGFkYXRhIHJlcXVpcmVzIEFQSXMgbm90IGF2YWlsYWJsZSBpbiBjdXJyZW50IE1DUFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBtYW5pZmVzdCA9IHtcclxuICAgICAgICAgICAgICAgIGZvbGRlcixcclxuICAgICAgICAgICAgICAgIGZvcm1hdCxcclxuICAgICAgICAgICAgICAgIGluY2x1ZGVNZXRhZGF0YTogZmFsc2UsIC8vIEFsd2F5cyBmYWxzZSAtIG1ldGFkYXRhIEFQSXMgbm90IGF2YWlsYWJsZVxyXG4gICAgICAgICAgICAgICAgYXNzZXRzLFxyXG4gICAgICAgICAgICAgICAgZXhwb3J0RGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgICAgICAgdG90YWxBc3NldHM6IGFzc2V0cy5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICBzdW1tYXJ5OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnlUeXBlOiB0aGlzLmdyb3VwQXNzZXRzQnlUeXBlKGFzc2V0cylcclxuICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiB0b3RhbFNpemUgY2FsY3VsYXRpb24gcmVtb3ZlZCAtIHJlcXVpcmVzIGZpbGUgc3lzdGVtIEFQSXMgbm90IGF2YWlsYWJsZSBpbiBNQ1BcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBBc3NldCBtYW5pZmVzdCBleHBvcnRlZCB3aXRoICR7YXNzZXRzLmxlbmd0aH0gYXNzZXRzYCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IG1hbmlmZXN0XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gZXhwb3J0IGFzc2V0IG1hbmlmZXN0OiAkeyhlcnJvciBhcyBFcnJvcikubWVzc2FnZX1gXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBwcml2YXRlIGdyb3VwQXNzZXRzQnlUeXBlKGFzc2V0czogYW55W10pOiBhbnkge1xyXG4gICAgICAgIGNvbnN0IGdyb3VwZWQ6IGFueSA9IHt9O1xyXG4gICAgICAgIGFzc2V0cy5mb3JFYWNoKGFzc2V0ID0+IHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGFzc2V0LnR5cGUgfHwgJ1Vua25vd24nO1xyXG4gICAgICAgICAgICBncm91cGVkW3R5cGVdID0gKGdyb3VwZWRbdHlwZV0gfHwgMCkgKyAxO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBncm91cGVkO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE5ldyBhc3NldCBvcGVyYXRpb24gbWV0aG9kcyBtb3ZlZCBmcm9tIHByb2plY3QtdG9vbHMudHNcclxuICAgIHByaXZhdGUgYXN5bmMgcmVmcmVzaEFzc2V0cyhmb2xkZXI/OiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBmb2xkZXIgfHwgJ2RiOi8vYXNzZXRzJztcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgdGFyZ2V0UGF0aCk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBBc3NldHMgcmVmcmVzaGVkIGluOiAke3RhcmdldFBhdGh9YCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHsgZm9sZGVyOiB0YXJnZXRQYXRoIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaW1wb3J0QXNzZXQoc291cmNlUGF0aDogc3RyaW5nLCB0YXJnZXRGb2xkZXI6IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNvdXJjZVBhdGgpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NvdXJjZSBmaWxlIG5vdCBmb3VuZCcgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGZpbGVOYW1lID0gcGF0aC5iYXNlbmFtZShzb3VyY2VQYXRoKTtcclxuICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gdGFyZ2V0Rm9sZGVyLnN0YXJ0c1dpdGgoJ2RiOi8vJykgP1xyXG4gICAgICAgICAgICB0YXJnZXRGb2xkZXIgOiBgZGI6Ly9hc3NldHMvJHt0YXJnZXRGb2xkZXJ9YDtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdpbXBvcnQtYXNzZXQnLCBzb3VyY2VQYXRoLCBgJHt0YXJnZXRQYXRofS8ke2ZpbGVOYW1lfWApO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgQXNzZXQgaW1wb3J0ZWQ6ICR7ZmlsZU5hbWV9YCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICB1dWlkOiByZXN1bHQudXVpZCxcclxuICAgICAgICAgICAgICAgICAgICBwYXRoOiByZXN1bHQudXJsLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0SW5mbyhhc3NldFBhdGg6IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXRQYXRoKTtcclxuICAgICAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0Fzc2V0IG5vdCBmb3VuZCcgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgaW5mbzogQXNzZXRJbmZvID0ge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXRJbmZvLm5hbWUsXHJcbiAgICAgICAgICAgICAgICB1dWlkOiBhc3NldEluZm8udXVpZCxcclxuICAgICAgICAgICAgICAgIHBhdGg6IGFzc2V0SW5mby51cmwsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldEluZm8udHlwZSxcclxuICAgICAgICAgICAgICAgIHNpemU6IGFzc2V0SW5mby5zaXplLFxyXG4gICAgICAgICAgICAgICAgaXNEaXJlY3Rvcnk6IGFzc2V0SW5mby5pc0RpcmVjdG9yeVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaWYgKGFzc2V0SW5mby5tZXRhKSB7XHJcbiAgICAgICAgICAgICAgICBpbmZvLm1ldGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVyOiBhc3NldEluZm8ubWV0YS52ZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgaW1wb3J0ZXI6IGFzc2V0SW5mby5tZXRhLmltcG9ydGVyXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgQXNzZXQgaW5mbyByZXRyaWV2ZWQ6ICR7aW5mby5uYW1lfWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBpbmZvXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0cyh0eXBlOiBzdHJpbmcgPSAnYWxsJywgZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBsZXQgcGF0dGVybnM6IHN0cmluZ1tdID0gW107XHJcblxyXG4gICAgICAgICAgICAvLyDlhrPlrprmkJzntKLojIPlm7RcclxuICAgICAgICAgICAgaWYgKGZvbGRlciA9PT0gJ2FsbCcpIHtcclxuICAgICAgICAgICAgICAgIC8vIOaQnOe0oueUqOaIt+i1hOa6kOWSjOWGhee9rui1hOa6kFxyXG4gICAgICAgICAgICAgICAgcGF0dGVybnMgPSBbJ2RiOi8vYXNzZXRzLyoqLyonLCAnZGI6Ly9pbnRlcm5hbC8qKi8qJ107XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZm9sZGVyID09PSAnZGI6Ly9pbnRlcm5hbCcpIHtcclxuICAgICAgICAgICAgICAgIC8vIOWPquaQnOe0ouWGhee9rui1hOa6kFxyXG4gICAgICAgICAgICAgICAgcGF0dGVybnMgPSBbJ2RiOi8vaW50ZXJuYWwvKiovKiddO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZvbGRlciA9PT0gJ2RiOi8vYXNzZXRzJykge1xyXG4gICAgICAgICAgICAgICAgLy8g5Y+q5pCc57Si55So5oi36LWE5rqQXHJcbiAgICAgICAgICAgICAgICBwYXR0ZXJucyA9IFsnZGI6Ly9hc3NldHMvKiovKiddO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8g5oyH5a6a5paH5Lu25aS5XHJcbiAgICAgICAgICAgICAgICBwYXR0ZXJucyA9IFtgJHtmb2xkZXJ9LyoqLypgXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g5aaC5p6c5oyH5a6a5LqG57G75Z6L77yM5re75Yqg5omp5bGV5ZCN6L+H5rukXHJcbiAgICAgICAgICAgIGlmICh0eXBlICE9PSAnYWxsJykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZUV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJ3NjZW5lJzogJy5zY2VuZScsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3ByZWZhYic6ICcucHJlZmFiJyxcclxuICAgICAgICAgICAgICAgICAgICAnc2NyaXB0JzogJy57dHMsanN9JyxcclxuICAgICAgICAgICAgICAgICAgICAndGV4dHVyZSc6ICcue3BuZyxqcGcsanBlZyxnaWYsdGdhLGJtcCxwc2R9JyxcclxuICAgICAgICAgICAgICAgICAgICAnbWF0ZXJpYWwnOiAnLm10bCcsXHJcbiAgICAgICAgICAgICAgICAgICAgJ21lc2gnOiAnLntmYngsb2JqLGRhZX0nLFxyXG4gICAgICAgICAgICAgICAgICAgICdhdWRpbyc6ICcue21wMyxvZ2csd2F2LG00YX0nLFxyXG4gICAgICAgICAgICAgICAgICAgICdhbmltYXRpb24nOiAnLnthbmltLGNsaXB9JyxcclxuICAgICAgICAgICAgICAgICAgICAnZWZmZWN0JzogJy5lZmZlY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgICdjaHVuayc6ICcuY2h1bmsnXHJcbiAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHR5cGVFeHRlbnNpb25zW3R5cGVdO1xyXG4gICAgICAgICAgICAgICAgaWYgKGV4dGVuc2lvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhdHRlcm5zID0gcGF0dGVybnMubWFwKHBhdHRlcm4gPT4gcGF0dGVybi5yZXBsYWNlKCcvKiovKicsIGAvKiovKiR7ZXh0ZW5zaW9ufWApKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtERUJVR10gU2VhcmNoaW5nIGFzc2V0cyB3aXRoIHBhdHRlcm5zOmAsIHBhdHRlcm5zKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOW5tuihjOafpeivouaJgOacieaooeW8j1xyXG4gICAgICAgICAgICBjb25zdCBhbGxSZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgICAgICAgICBwYXR0ZXJucy5tYXAocGF0dGVybiA9PlxyXG4gICAgICAgICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybjogcGF0dGVybiB9KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0RFQlVHXSBQYXR0ZXJuICR7cGF0dGVybn0gZmFpbGVkOmAsIGVycik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAvLyDlkIjlubbnu5Pmnpzlubbljrvph41cclxuICAgICAgICAgICAgY29uc3QgY29tYmluZWRSZXN1bHRzID0gYWxsUmVzdWx0cy5mbGF0KCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHVuaXF1ZUFzc2V0cyA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbWJpbmVkUmVzdWx0cy5mb3JFYWNoKGFzc2V0ID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiBhc3NldC51dWlkICYmICF1bmlxdWVBc3NldHMuaGFzKGFzc2V0LnV1aWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdW5pcXVlQXNzZXRzLnNldChhc3NldC51dWlkLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IGFzc2V0LnV1aWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGFzc2V0LnVybCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogYXNzZXQudHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZTogKGFzc2V0IGFzIGFueSkuc2l6ZSB8fCAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0RpcmVjdG9yeTogKGFzc2V0IGFzIGFueSkuaXNEaXJlY3RvcnkgfHwgZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzQnVpbHRJbjogYXNzZXQudXJsLnN0YXJ0c1dpdGgoJ2RiOi8vaW50ZXJuYWwnKVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IEFycmF5LmZyb20odW5pcXVlQXNzZXRzLnZhbHVlcygpKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOaMieexu+Wei+WIhue7hOe7n+iuoVxyXG4gICAgICAgICAgICBjb25zdCB1c2VyQXNzZXRzID0gYXNzZXRzLmZpbHRlcihhID0+ICFhLmlzQnVpbHRJbik7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWx0SW5Bc3NldHMgPSBhc3NldHMuZmlsdGVyKGEgPT4gYS5pc0J1aWx0SW4pO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIEZvdW5kICR7YXNzZXRzLmxlbmd0aH0gYXNzZXRzICgke3VzZXJBc3NldHMubGVuZ3RofSB1c2VyICsgJHtidWlsdEluQXNzZXRzLmxlbmd0aH0gYnVpbHQtaW4pIG9mIHR5cGUgJyR7dHlwZX0nYCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0eXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIGZvbGRlcjogZm9sZGVyLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiBhc3NldHMubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgICAgIHVzZXJDb3VudDogdXNlckFzc2V0cy5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICAgICAgYnVpbHRJbkNvdW50OiBidWlsdEluQXNzZXRzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgICBhc3NldHM6IGFzc2V0c1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVBc3NldCh1cmw6IHN0cmluZywgY29udGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGwsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xyXG4gICAgICAgICAgICBvdmVyd3JpdGU6IG92ZXJ3cml0ZSxcclxuICAgICAgICAgICAgcmVuYW1lOiAhb3ZlcndyaXRlXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCB1cmwsIGNvbnRlbnQsIG9wdGlvbnMpO1xyXG4gICAgICAgICAgICBjb25zdCBhc3NldFR5cGUgPSBjb250ZW50ID09PSBudWxsID8gJ0ZvbGRlcicgOiAnRmlsZSc7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSAke2Fzc2V0VHlwZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHlgLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IHJlc3VsdD8udXVpZCxcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IHJlc3VsdD8udXJsIHx8IHVybCxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBhc3NldFR5cGUudG9Mb3dlckNhc2UoKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjb3B5QXNzZXQoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgb3ZlcndyaXRlOiBvdmVyd3JpdGUsXHJcbiAgICAgICAgICAgIHJlbmFtZTogIW92ZXJ3cml0ZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY29weS1hc3NldCcsIHNvdXJjZSwgdGFyZ2V0LCBvcHRpb25zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIEFzc2V0IGNvcGllZCBzdWNjZXNzZnVsbHlgLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IHJlc3VsdD8udXVpZCxcclxuICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IHNvdXJjZSxcclxuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHJlc3VsdD8udXJsIHx8IHRhcmdldFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBtb3ZlQXNzZXQoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgb3ZlcndyaXRlOiBvdmVyd3JpdGUsXHJcbiAgICAgICAgICAgIHJlbmFtZTogIW92ZXJ3cml0ZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnbW92ZS1hc3NldCcsIHNvdXJjZSwgdGFyZ2V0LCBvcHRpb25zKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIEFzc2V0IG1vdmVkIHN1Y2Nlc3NmdWxseWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0Py51dWlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZTogc291cmNlLFxyXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogcmVzdWx0Py51cmwgfHwgdGFyZ2V0XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGRlbGV0ZUFzc2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdkZWxldGUtYXNzZXQnLCB1cmwpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgQXNzZXQgZGVsZXRlZCBzdWNjZXNzZnVsbHlgLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogeyB1cmwgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXQodXJsOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgdXJsLCBjb250ZW50KTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIEFzc2V0IHNhdmVkIHN1Y2Nlc3NmdWxseWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0Py51dWlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHVybDogcmVzdWx0Py51cmwgfHwgdXJsXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlaW1wb3J0QXNzZXQodXJsOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgdXJsKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIEFzc2V0IHJlaW1wb3J0ZWQgc3VjY2Vzc2Z1bGx5YCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHsgdXJsIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFBhdGgodXJsOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0UGF0aDogc3RyaW5nIHwgbnVsbCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXBhdGgnLCB1cmwpO1xyXG4gICAgICAgICAgICBpZiAoYXNzZXRQYXRoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBBc3NldCBwYXRoIHJldHJpZXZlZGAsXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyB1cmwsIHBhdGg6IGFzc2V0UGF0aCB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXNzZXQgcGF0aCBub3QgZm91bmQnIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFV1aWQodXJsOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHV1aWQ6IHN0cmluZyB8IG51bGwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11dWlkJywgdXJsKTtcclxuICAgICAgICAgICAgaWYgKHV1aWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBg4pyFIEFzc2V0IFVVSUQgcmV0cmlldmVkYCxcclxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHVybCwgdXVpZCB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXNzZXQgVVVJRCBub3QgZm91bmQnIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFVybCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHVybDogc3RyaW5nIHwgbnVsbCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXVybCcsIHV1aWQpO1xyXG4gICAgICAgICAgICBpZiAodXJsKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBBc3NldCBVUkwgcmV0cmlldmVkYCxcclxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHV1aWQsIHVybCB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXNzZXQgVVJMIG5vdCBmb3VuZCcgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kQXNzZXRCeU5hbWUoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IG5hbWUsIGV4YWN0TWF0Y2ggPSBmYWxzZSwgYXNzZXRUeXBlID0gJ2FsbCcsIGZvbGRlciA9ICdkYjovL2Fzc2V0cycsIG1heFJlc3VsdHMgPSAyMCB9ID0gYXJncztcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgYWxsQXNzZXRzUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldEFzc2V0cyhhc3NldFR5cGUsIGZvbGRlcik7XHJcbiAgICAgICAgICAgIGlmICghYWxsQXNzZXRzUmVzcG9uc2Uuc3VjY2VzcyB8fCAhYWxsQXNzZXRzUmVzcG9uc2UuZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBnZXQgYXNzZXRzOiAke2FsbEFzc2V0c1Jlc3BvbnNlLmVycm9yfWBcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGFsbEFzc2V0cyA9IGFsbEFzc2V0c1Jlc3BvbnNlLmRhdGEuYXNzZXRzIGFzIGFueVtdO1xyXG4gICAgICAgICAgICBsZXQgbWF0Y2hlZEFzc2V0czogYW55W10gPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYWxsQXNzZXRzKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldE5hbWUgPSBhc3NldC5uYW1lO1xyXG4gICAgICAgICAgICAgICAgbGV0IG1hdGNoZXMgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoZXhhY3RNYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMgPSBhc3NldE5hbWUgPT09IG5hbWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMgPSBhc3NldE5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhuYW1lLnRvTG93ZXJDYXNlKCkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGV0YWlsUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldEFzc2V0SW5mbyhhc3NldC5wYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldGFpbFJlc3BvbnNlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBc3NldHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4uYXNzZXQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogZGV0YWlsUmVzcG9uc2UuZGF0YVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXNzZXRzLnB1c2goYXNzZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBc3NldHMucHVzaChhc3NldCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlZEFzc2V0cy5sZW5ndGggPj0gbWF4UmVzdWx0cykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYOKchSBGb3VuZCAke21hdGNoZWRBc3NldHMubGVuZ3RofSBhc3NldHMgbWF0Y2hpbmcgJyR7bmFtZX0nYCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBzZWFyY2hUZXJtOiBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIGV4YWN0TWF0Y2gsXHJcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRUeXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIGZvbGRlcixcclxuICAgICAgICAgICAgICAgICAgICB0b3RhbEZvdW5kOiBtYXRjaGVkQXNzZXRzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgICBtYXhSZXN1bHRzLFxyXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0czogbWF0Y2hlZEFzc2V0c1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBgQXNzZXQgc2VhcmNoIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXREZXRhaWxzKGFzc2V0UGF0aDogc3RyaW5nLCBpbmNsdWRlU3ViQXNzZXRzOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldEFzc2V0SW5mbyhhc3NldFBhdGgpO1xyXG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mb1Jlc3BvbnNlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBhc3NldEluZm9SZXNwb25zZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXNzZXRJbmZvUmVzcG9uc2UuZGF0YTtcclxuICAgICAgICAgICAgY29uc3QgZGV0YWlsZWRJbmZvOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICAuLi5hc3NldEluZm8sXHJcbiAgICAgICAgICAgICAgICBzdWJBc3NldHM6IFtdXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICBpZiAoaW5jbHVkZVN1YkFzc2V0cyAmJiBhc3NldEluZm8pIHtcclxuICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8udHlwZSA9PT0gJ2NjLkltYWdlQXNzZXQnIHx8IGFzc2V0UGF0aC5tYXRjaCgvXFwuKHBuZ3xqcGd8anBlZ3xnaWZ8dGdhfGJtcHxwc2QpJC9pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VVdWlkID0gYXNzZXRJbmZvLnV1aWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zc2libGVTdWJBc3NldHMgPSBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3Nwcml0ZUZyYW1lJywgdXVpZDogYCR7YmFzZVV1aWR9QGY5OTQxYCwgc3VmZml4OiAnQGY5OTQxJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICd0ZXh0dXJlJywgdXVpZDogYCR7YmFzZVV1aWR9QDZjNDhhYCwgc3VmZml4OiAnQDZjNDhhJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICd0ZXh0dXJlMkQnLCB1dWlkOiBgJHtiYXNlVXVpZH1ANmM0OGFgLCBzdWZmaXg6ICdANmM0OGEnIH1cclxuICAgICAgICAgICAgICAgICAgICBdO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN1YkFzc2V0IG9mIHBvc3NpYmxlU3ViQXNzZXRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJBc3NldFVybCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXVybCcsIHN1YkFzc2V0LnV1aWQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1YkFzc2V0VXJsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsZWRJbmZvLnN1YkFzc2V0cy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogc3ViQXNzZXQudHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogc3ViQXNzZXQudXVpZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBzdWJBc3NldFVybCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VmZml4OiBzdWJBc3NldC5zdWZmaXhcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdWItYXNzZXQgZG9lc24ndCBleGlzdCwgc2tpcCBpdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGDinIUgQXNzZXQgZGV0YWlscyByZXRyaWV2ZWQuIEZvdW5kICR7ZGV0YWlsZWRJbmZvLnN1YkFzc2V0cy5sZW5ndGh9IHN1Yi1hc3NldHNgLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0UGF0aCxcclxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlU3ViQXNzZXRzLFxyXG4gICAgICAgICAgICAgICAgICAgIC4uLmRldGFpbGVkSW5mb1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBgRmFpbGVkIHRvIGdldCBhc3NldCBkZXRhaWxzOiAke2Vycm9yLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufSJdfQ==