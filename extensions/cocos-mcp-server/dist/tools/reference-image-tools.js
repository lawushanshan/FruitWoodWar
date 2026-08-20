"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceImageTools = void 0;
class ReferenceImageTools {
    getTools() {
        return [
            // 1. Reference Image Management - Basic operations
            {
                name: 'reference_image_management',
                description: 'REFERENCE IMAGE MANAGEMENT: Manage overlay reference images in the scene editor for design guidance. WORKFLOW: "add" images from file paths → "switch" between multiple references → "remove" when no longer needed OR "clear_all" to reset. Essential for UI design and scene layout matching.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['add', 'remove', 'switch', 'clear_all'],
                            description: 'Management operation: "add" = add reference images from file paths (requires paths array) | "remove" = remove specific images (requires removePaths array) | "switch" = change active reference (requires path) | "clear_all" = remove all references (no parameters)'
                        },
                        // For add action
                        paths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Image file paths to add (REQUIRED for add action). Array of absolute paths to image files. Supported formats: PNG, JPG, JPEG, GIF. Examples: ["/Users/username/Desktop/mockup.png", "/path/to/ui-design.jpg"]. Files must exist and be readable.'
                        },
                        // For remove action
                        removePaths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Image paths to remove (remove action). Array of absolute paths matching previously added images. If empty array [], removes current active reference. Examples: ["/path/to/old-mockup.png"]. Use exact paths from previous add operations.'
                        },
                        // For switch action
                        path: {
                            type: 'string',
                            description: 'Target reference image path (REQUIRED for switch action). Absolute path to previously added reference image. Must match exactly with previously added image path. Example: "/Users/username/Desktop/design-mockup.png".'
                        },
                        sceneUUID: {
                            type: 'string',
                            description: 'Scene UUID for switch operation (switch action, optional). Specifies which scene to switch reference in. If omitted, uses current active scene. Format: "12345678-abcd-1234-5678-123456789abc". Rarely needed unless working with multiple scenes.'
                        }
                    },
                    required: ['action']
                }
            },
            // 2. Reference Image Query - Get information
            {
                name: 'reference_image_query',
                description: 'REFERENCE IMAGE QUERY: Inspect current reference image state and configuration. USAGE: "get_config" for system settings, "get_current" for active image details, "list_all" for inventory of added images. Essential for understanding current reference setup and debugging display issues.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['get_config', 'get_current', 'list_all'],
                            description: 'Query operation: "get_config" = system configuration and settings | "get_current" = active reference image details (path, position, scale, opacity) | "list_all" = complete inventory of added reference images'
                        }
                    },
                    required: ['action']
                }
            },
            // 3. Reference Image Transform - Position, scale, opacity
            {
                name: 'reference_image_transform',
                description: 'REFERENCE IMAGE TRANSFORM: Adjust reference image display properties for better design alignment. USAGE: Fine-tune position, scale, and opacity to overlay images properly with scene content. Essential for precise UI design matching and layout guidance.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['set_position', 'set_scale', 'set_opacity', 'set_data'],
                            description: 'Transform operation: "set_position" = adjust image position (requires x, y) | "set_scale" = resize image (requires sx, sy) | "set_opacity" = change transparency (requires opacity) | "set_data" = modify any property (requires key, value)'
                        },
                        // For set_position action
                        x: {
                            type: 'number',
                            description: 'Horizontal position offset (REQUIRED for set_position). Pixels from center. Positive = right, negative = left. Examples: 100 moves right, -50 moves left. Use for precise image alignment with scene elements.'
                        },
                        y: {
                            type: 'number',
                            description: 'Vertical position offset (REQUIRED for set_position). Pixels from center. Positive = up, negative = down. Examples: 200 moves up, -100 moves down. Coordinate system follows Cocos Creator convention.'
                        },
                        // For set_scale action
                        sx: {
                            type: 'number',
                            description: 'Horizontal scale multiplier (REQUIRED for set_scale). Range: 0.1-10.0. 1.0 = original size, 0.5 = half size, 2.0 = double size. Examples: 0.8 for smaller overlay, 1.2 for slightly larger reference.',
                            minimum: 0.1,
                            maximum: 10
                        },
                        sy: {
                            type: 'number',
                            description: 'Vertical scale multiplier (REQUIRED for set_scale). Range: 0.1-10.0. 1.0 = original size, 0.5 = half size, 2.0 = double size. Usually matches sx for proportional scaling. Set different values for aspect ratio adjustment.',
                            minimum: 0.1,
                            maximum: 10
                        },
                        // For set_opacity action
                        opacity: {
                            type: 'number',
                            description: 'Transparency level (REQUIRED for set_opacity). Range: 0.0-1.0. 0.0 = invisible, 1.0 = fully opaque, 0.5 = semi-transparent. Recommended: 0.3-0.7 for subtle overlay, 0.8-1.0 for clear reference.',
                            minimum: 0,
                            maximum: 1
                        },
                        // For set_data action
                        key: {
                            type: 'string',
                            description: 'Property name to modify (REQUIRED for set_data). Available keys: "path" (image file), "x" (horizontal position), "y" (vertical position), "sx" (horizontal scale), "sy" (vertical scale), "opacity" (transparency). Use for programmatic property updates.',
                            enum: ['path', 'x', 'y', 'sx', 'sy', 'opacity']
                        },
                        value: {
                            description: 'Property value to assign (REQUIRED for set_data). Type varies by key: string for "path" (file path), number for position/scale/opacity. Examples: "/new/path.png" for path, 150 for x/y, 1.5 for sx/sy, 0.7 for opacity.'
                        }
                    },
                    required: ['action']
                }
            },
            // 4. Reference Image Display - Refresh and utilities
            {
                name: 'reference_image_display',
                description: 'REFERENCE IMAGE DISPLAY: Update and refresh reference image rendering in the scene view. USAGE: "refresh" to force display update after changes or when images appear corrupted. Use when reference images don\'t display correctly or after system changes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['refresh'],
                            description: 'Display operation: "refresh" = force update reference image rendering and visibility (no parameters needed). Use when images don\'t appear or display incorrectly.'
                        }
                    },
                    required: ['action']
                }
            }
        ];
    }
    async execute(toolName, args) {
        switch (toolName) {
            case 'reference_image_management':
                return await this.handleImageManagement(args);
            case 'reference_image_query':
                return await this.handleImageQuery(args);
            case 'reference_image_transform':
                return await this.handleImageTransform(args);
            case 'reference_image_display':
                return await this.handleImageDisplay(args);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    async addReferenceImage(paths) {
        // 验证路径格式
        const invalidPaths = paths.filter(path => !path || typeof path !== 'string');
        if (invalidPaths.length > 0) {
            return {
                success: false,
                error: `Invalid paths provided: ${invalidPaths.join(', ')}`
            };
        }
        try {
            await Editor.Message.request('reference-image', 'add-image', paths);
            return {
                success: true,
                data: {
                    addedPaths: paths,
                    count: paths.length,
                    message: `Added ${paths.length} reference image(s)`
                }
            };
        }
        catch (err) {
            // 增强错误信息
            let errorMessage = err.message;
            if (err.message.includes('not found') || err.message.includes('not exist')) {
                errorMessage = `Image file not found: ${paths.join(', ')}. Please check if the file exists and the path is correct.`;
            }
            else if (err.message.includes('permission')) {
                errorMessage = `Permission denied accessing image files: ${paths.join(', ')}. Please check file permissions.`;
            }
            else if (err.message.includes('format')) {
                errorMessage = `Unsupported image format: ${paths.join(', ')}. Please use supported formats (PNG, JPG, JPEG).`;
            }
            return {
                success: false,
                error: errorMessage,
                data: {
                    failedPaths: paths,
                    suggestion: 'Please verify the image paths and file existence.'
                }
            };
        }
    }
    async removeReferenceImage(paths) {
        try {
            await Editor.Message.request('reference-image', 'remove-image', paths);
            const message = paths && paths.length > 0 ?
                `Removed ${paths.length} reference image(s)` :
                'Removed current reference image';
            return {
                success: true,
                message: message
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async switchReferenceImage(path, sceneUUID) {
        var _a, _b;
        // 验证路径格式
        if (!path || typeof path !== 'string') {
            return {
                success: false,
                error: 'Invalid image path provided. Please provide a valid file path.'
            };
        }
        try {
            const args = sceneUUID ? [path, sceneUUID] : [path];
            const result = await Editor.Message.request('reference-image', 'switch-image', ...args);
            // 检查是否有警告信息
            const hasWarning = result && (result.warning || ((_a = result.message) === null || _a === void 0 ? void 0 : _a.includes('blank')) || ((_b = result.message) === null || _b === void 0 ? void 0 : _b.includes('not found')));
            return {
                success: true,
                data: {
                    path: path,
                    sceneUUID: sceneUUID,
                    message: `Switched to reference image: ${path}`,
                    warning: hasWarning ? 'Image may be blank or not found. Please verify the image file exists.' : undefined
                },
                warning: hasWarning ? 'Image may be blank or not found. Please verify the image file exists.' : undefined
            };
        }
        catch (err) {
            let errorMessage = err.message;
            if (err.message.includes('not found') || err.message.includes('not exist')) {
                errorMessage = `Image file not found: ${path}. Please check if the file exists and the path is correct.`;
            }
            else if (err.message.includes('permission')) {
                errorMessage = `Permission denied accessing image file: ${path}. Please check file permissions.`;
            }
            else if (err.message.includes('format')) {
                errorMessage = `Unsupported image format: ${path}. Please use supported formats (PNG, JPG, JPEG).`;
            }
            return {
                success: false,
                error: errorMessage,
                data: {
                    failedPath: path,
                    suggestion: 'Please verify the image path and file existence.'
                }
            };
        }
    }
    async setReferenceImageData(key, value) {
        try {
            await Editor.Message.request('reference-image', 'set-image-data', key, value);
            return {
                success: true,
                data: {
                    key: key,
                    value: value,
                    message: `Reference image ${key} set to ${value}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryReferenceImageConfig() {
        try {
            const config = await Editor.Message.request('reference-image', 'query-config');
            // 数据一致性检查
            const consistencyIssues = this.checkDataConsistency(config);
            return {
                success: true,
                data: Object.assign(Object.assign({}, config), { dataConsistency: {
                        issues: consistencyIssues,
                        hasIssues: consistencyIssues.length > 0
                    } }),
                warning: consistencyIssues.length > 0 ?
                    `Data consistency issues detected: ${consistencyIssues.join(', ')}` : undefined
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    checkDataConsistency(config) {
        const issues = [];
        if (!config) {
            issues.push('No configuration data available');
            return issues;
        }
        // 检查配置中的图片列表
        if (config.images && Array.isArray(config.images)) {
            const deletedImages = config.images.filter((img) => img.path && (img.path.includes('deleted') || img.path.includes('nonexistent')));
            if (deletedImages.length > 0) {
                issues.push(`Found ${deletedImages.length} deleted/nonexistent images in configuration`);
            }
            // 检查当前图片是否在列表中
            if (config.current && !config.images.find((img) => img.path === config.current)) {
                issues.push('Current image not found in image list');
            }
            // 检查重复的图片路径
            const paths = config.images.map((img) => img.path).filter(Boolean);
            const uniquePaths = new Set(paths);
            if (paths.length !== uniquePaths.size) {
                issues.push('Duplicate image paths found in configuration');
            }
        }
        // 检查当前图片设置
        if (config.current && typeof config.current !== 'string') {
            issues.push('Invalid current image path format');
        }
        return issues;
    }
    async queryCurrentReferenceImage() {
        try {
            const current = await Editor.Message.request('reference-image', 'query-current');
            return {
                success: true,
                data: current
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async refreshReferenceImage() {
        try {
            await Editor.Message.request('reference-image', 'refresh');
            return {
                success: true,
                message: 'Reference image refreshed'
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async setReferenceImagePosition(x, y) {
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'x', x);
            await Editor.Message.request('reference-image', 'set-image-data', 'y', y);
            return {
                success: true,
                data: {
                    x: x,
                    y: y,
                    message: `Reference image position set to (${x}, ${y})`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async setReferenceImageScale(sx, sy) {
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'sx', sx);
            await Editor.Message.request('reference-image', 'set-image-data', 'sy', sy);
            return {
                success: true,
                data: {
                    sx: sx,
                    sy: sy,
                    message: `Reference image scale set to (${sx}, ${sy})`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async setReferenceImageOpacity(opacity) {
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'opacity', opacity);
            return {
                success: true,
                data: {
                    opacity: opacity,
                    message: `Reference image opacity set to ${opacity}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async listReferenceImages() {
        try {
            const config = await Editor.Message.request('reference-image', 'query-config');
            const current = await Editor.Message.request('reference-image', 'query-current');
            return {
                success: true,
                data: {
                    config: config,
                    current: current,
                    message: 'Reference image information retrieved'
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async clearAllReferenceImages() {
        try {
            // Remove all reference images by calling remove-image without paths
            await Editor.Message.request('reference-image', 'remove-image');
            return {
                success: true,
                message: 'All reference images cleared'
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    // New handler methods for optimized tools
    async handleImageManagement(args) {
        const { action } = args;
        switch (action) {
            case 'add':
                return await this.addReferenceImage(args.paths);
            case 'remove':
                return await this.removeReferenceImage(args.removePaths);
            case 'switch':
                return await this.switchReferenceImage(args.path, args.sceneUUID);
            case 'clear_all':
                return await this.clearAllReferenceImages();
            default:
                return { success: false, error: `Unknown image management action: ${action}` };
        }
    }
    async handleImageQuery(args) {
        const { action } = args;
        switch (action) {
            case 'get_config':
                return await this.queryReferenceImageConfig();
            case 'get_current':
                return await this.queryCurrentReferenceImage();
            case 'list_all':
                return await this.listReferenceImages();
            default:
                return { success: false, error: `Unknown image query action: ${action}` };
        }
    }
    async handleImageTransform(args) {
        const { action } = args;
        switch (action) {
            case 'set_position':
                return await this.setReferenceImagePosition(args.x, args.y);
            case 'set_scale':
                return await this.setReferenceImageScale(args.sx, args.sy);
            case 'set_opacity':
                return await this.setReferenceImageOpacity(args.opacity);
            case 'set_data':
                return await this.setReferenceImageData(args.key, args.value);
            default:
                return { success: false, error: `Unknown image transform action: ${action}` };
        }
    }
    async handleImageDisplay(args) {
        const { action } = args;
        switch (action) {
            case 'refresh':
                return await this.refreshReferenceImage();
            default:
                return { success: false, error: `Unknown image display action: ${action}` };
        }
    }
}
exports.ReferenceImageTools = ReferenceImageTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmZXJlbmNlLWltYWdlLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL3JlZmVyZW5jZS1pbWFnZS10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxNQUFhLG1CQUFtQjtJQUM1QixRQUFRO1FBQ0osT0FBTztZQUNILG1EQUFtRDtZQUNuRDtnQkFDSSxJQUFJLEVBQUUsNEJBQTRCO2dCQUNsQyxXQUFXLEVBQUUsaVNBQWlTO2dCQUM5UyxXQUFXLEVBQUU7b0JBQ1QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLE1BQU0sRUFBRTs0QkFDSixJQUFJLEVBQUUsUUFBUTs0QkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUM7NEJBQzlDLFdBQVcsRUFBRSx1UUFBdVE7eUJBQ3ZSO3dCQUNELGlCQUFpQjt3QkFDakIsS0FBSyxFQUFFOzRCQUNILElBQUksRUFBRSxPQUFPOzRCQUNiLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7NEJBQ3pCLFdBQVcsRUFBRSxrUEFBa1A7eUJBQ2xRO3dCQUNELG9CQUFvQjt3QkFDcEIsV0FBVyxFQUFFOzRCQUNULElBQUksRUFBRSxPQUFPOzRCQUNiLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7NEJBQ3pCLFdBQVcsRUFBRSw0T0FBNE87eUJBQzVQO3dCQUNELG9CQUFvQjt3QkFDcEIsSUFBSSxFQUFFOzRCQUNGLElBQUksRUFBRSxRQUFROzRCQUNkLFdBQVcsRUFBRSx5TkFBeU47eUJBQ3pPO3dCQUNELFNBQVMsRUFBRTs0QkFDUCxJQUFJLEVBQUUsUUFBUTs0QkFDZCxXQUFXLEVBQUUsb1BBQW9QO3lCQUNwUTtxQkFDSjtvQkFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7aUJBQ3ZCO2FBQ0o7WUFFRCw2Q0FBNkM7WUFDN0M7Z0JBQ0ks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TyxLQUFLLENBQUMsa0JBQWtCLENBQUMsSUFBUztRQUN0QyxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRXhCLFFBQVEsTUFBTSxFQUFFLENBQUM7WUFDYixLQUFLLFNBQVM7Z0JBQ1YsT0FBTyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQzlDO2dCQUNJLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxpQ0FBaUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztRQUNwRixDQUFDO0lBQ0wsQ0FBQztDQUVKO0FBaGZELGtEQWdmQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRvb2xEZWZpbml0aW9uLCBUb29sUmVzcG9uc2UsIFRvb2xFeGVjdXRvciB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2VJbWFnZVRvb2xzIGltcGxlbWVudHMgVG9vbEV4ZWN1dG9yIHtcclxuICAgIGdldFRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW10ge1xyXG4gICAgICAgIHJldHVybiBbXHJcbiAgICAgICAgICAgIC8vIDEuIFJlZmVyZW5jZSBJbWFnZSBNYW5hZ2VtZW50IC0gQmFzaWMgb3BlcmF0aW9uc1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAncmVmZXJlbmNlX2ltYWdlX21hbmFnZW1lbnQnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdSRUZFUkVOQ0UgSU1BR0UgTUFOQUdFTUVOVDogTWFuYWdlIG92ZXJsYXkgcmVmZXJlbmNlIGltYWdlcyBpbiB0aGUgc2NlbmUgZWRpdG9yIGZvciBkZXNpZ24gZ3VpZGFuY2UuIFdPUktGTE9XOiBcImFkZFwiIGltYWdlcyBmcm9tIGZpbGUgcGF0aHMg4oaSIFwic3dpdGNoXCIgYmV0d2VlbiBtdWx0aXBsZSByZWZlcmVuY2VzIOKGkiBcInJlbW92ZVwiIHdoZW4gbm8gbG9uZ2VyIG5lZWRlZCBPUiBcImNsZWFyX2FsbFwiIHRvIHJlc2V0LiBFc3NlbnRpYWwgZm9yIFVJIGRlc2lnbiBhbmQgc2NlbmUgbGF5b3V0IG1hdGNoaW5nLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnYWRkJywgJ3JlbW92ZScsICdzd2l0Y2gnLCAnY2xlYXJfYWxsJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ01hbmFnZW1lbnQgb3BlcmF0aW9uOiBcImFkZFwiID0gYWRkIHJlZmVyZW5jZSBpbWFnZXMgZnJvbSBmaWxlIHBhdGhzIChyZXF1aXJlcyBwYXRocyBhcnJheSkgfCBcInJlbW92ZVwiID0gcmVtb3ZlIHNwZWNpZmljIGltYWdlcyAocmVxdWlyZXMgcmVtb3ZlUGF0aHMgYXJyYXkpIHwgXCJzd2l0Y2hcIiA9IGNoYW5nZSBhY3RpdmUgcmVmZXJlbmNlIChyZXF1aXJlcyBwYXRoKSB8IFwiY2xlYXJfYWxsXCIgPSByZW1vdmUgYWxsIHJlZmVyZW5jZXMgKG5vIHBhcmFtZXRlcnMpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3IgYWRkIGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ltYWdlIGZpbGUgcGF0aHMgdG8gYWRkIChSRVFVSVJFRCBmb3IgYWRkIGFjdGlvbikuIEFycmF5IG9mIGFic29sdXRlIHBhdGhzIHRvIGltYWdlIGZpbGVzLiBTdXBwb3J0ZWQgZm9ybWF0czogUE5HLCBKUEcsIEpQRUcsIEdJRi4gRXhhbXBsZXM6IFtcIi9Vc2Vycy91c2VybmFtZS9EZXNrdG9wL21vY2t1cC5wbmdcIiwgXCIvcGF0aC90by91aS1kZXNpZ24uanBnXCJdLiBGaWxlcyBtdXN0IGV4aXN0IGFuZCBiZSByZWFkYWJsZS4nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciByZW1vdmUgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZVBhdGhzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW1hZ2UgcGF0aHMgdG8gcmVtb3ZlIChyZW1vdmUgYWN0aW9uKS4gQXJyYXkgb2YgYWJzb2x1dGUgcGF0aHMgbWF0Y2hpbmcgcHJldmlvdXNseSBhZGRlZCBpbWFnZXMuIElmIGVtcHR5IGFycmF5IFtdLCByZW1vdmVzIGN1cnJlbnQgYWN0aXZlIHJlZmVyZW5jZS4gRXhhbXBsZXM6IFtcIi9wYXRoL3RvL29sZC1tb2NrdXAucG5nXCJdLiBVc2UgZXhhY3QgcGF0aHMgZnJvbSBwcmV2aW91cyBhZGQgb3BlcmF0aW9ucy4nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBzd2l0Y2ggYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgcmVmZXJlbmNlIGltYWdlIHBhdGggKFJFUVVJUkVEIGZvciBzd2l0Y2ggYWN0aW9uKS4gQWJzb2x1dGUgcGF0aCB0byBwcmV2aW91c2x5IGFkZGVkIHJlZmVyZW5jZSBpbWFnZS4gTXVzdCBtYXRjaCBleGFjdGx5IHdpdGggcHJldmlvdXNseSBhZGRlZCBpbWFnZSBwYXRoLiBFeGFtcGxlOiBcIi9Vc2Vycy91c2VybmFtZS9EZXNrdG9wL2Rlc2lnbi1tb2NrdXAucG5nXCIuJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzY2VuZVVVSUQ6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTY2VuZSBVVUlEIGZvciBzd2l0Y2ggb3BlcmF0aW9uIChzd2l0Y2ggYWN0aW9uLCBvcHRpb25hbCkuIFNwZWNpZmllcyB3aGljaCBzY2VuZSB0byBzd2l0Y2ggcmVmZXJlbmNlIGluLiBJZiBvbWl0dGVkLCB1c2VzIGN1cnJlbnQgYWN0aXZlIHNjZW5lLiBGb3JtYXQ6IFwiMTIzNDU2NzgtYWJjZC0xMjM0LTU2NzgtMTIzNDU2Nzg5YWJjXCIuIFJhcmVseSBuZWVkZWQgdW5sZXNzIHdvcmtpbmcgd2l0aCBtdWx0aXBsZSBzY2VuZXMuJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgLy8gMi4gUmVmZXJlbmNlIEltYWdlIFF1ZXJ5IC0gR2V0IGluZm9ybWF0aW9uXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdyZWZlcmVuY2VfaW1hZ2VfcXVlcnknLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdSRUZFUkVOQ0UgSU1BR0UgUVVFUlk6IEluc3BlY3QgY3VycmVudCByZWZlcmVuY2UgaW1hZ2Ugc3RhdGUgYW5kIGNvbmZpZ3VyYXRpb24uIFVTQUdFOiBcImdldF9jb25maWdcIiBmb3Igc3lzdGVtIHNldHRpbmdzLCBcImdldF9jdXJyZW50XCIgZm9yIGFjdGl2ZSBpbWFnZSBkZXRhaWxzLCBcImxpc3RfYWxsXCIgZm9yIGludmVudG9yeSBvZiBhZGRlZCBpbWFnZXMuIEVzc2VudGlhbCBmb3IgdW5kZXJzdGFuZGluZyBjdXJyZW50IHJlZmVyZW5jZSBzZXR1cCBhbmQgZGVidWdnaW5nIGRpc3BsYXkgaXNzdWVzLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2NvbmZpZycsICdnZXRfY3VycmVudCcsICdsaXN0X2FsbCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdRdWVyeSBvcGVyYXRpb246IFwiZ2V0X2NvbmZpZ1wiID0gc3lzdGVtIGNvbmZpZ3VyYXRpb24gYW5kIHNldHRpbmdzIHwgXCJnZXRfY3VycmVudFwiID0gYWN0aXZlIHJlZmVyZW5jZSBpbWFnZSBkZXRhaWxzIChwYXRoLCBwb3NpdGlvbiwgc2NhbGUsIG9wYWNpdHkpIHwgXCJsaXN0X2FsbFwiID0gY29tcGxldGUgaW52ZW50b3J5IG9mIGFkZGVkIHJlZmVyZW5jZSBpbWFnZXMnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAvLyAzLiBSZWZlcmVuY2UgSW1hZ2UgVHJhbnNmb3JtIC0gUG9zaXRpb24sIHNjYWxlLCBvcGFjaXR5XHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdyZWZlcmVuY2VfaW1hZ2VfdHJhbnNmb3JtJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUkVGRVJFTkNFIElNQUdFIFRSQU5TRk9STTogQWRqdXN0IHJlZmVyZW5jZSBpbWFnZSBkaXNwbGF5IHByb3BlcnRpZXMgZm9yIGJldHRlciBkZXNpZ24gYWxpZ25tZW50LiBVU0FHRTogRmluZS10dW5lIHBvc2l0aW9uLCBzY2FsZSwgYW5kIG9wYWNpdHkgdG8gb3ZlcmxheSBpbWFnZXMgcHJvcGVybHkgd2l0aCBzY2VuZSBjb250ZW50LiBFc3NlbnRpYWwgZm9yIHByZWNpc2UgVUkgZGVzaWduIG1hdGNoaW5nIGFuZCBsYXlvdXQgZ3VpZGFuY2UuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydzZXRfcG9zaXRpb24nLCAnc2V0X3NjYWxlJywgJ3NldF9vcGFjaXR5JywgJ3NldF9kYXRhJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RyYW5zZm9ybSBvcGVyYXRpb246IFwic2V0X3Bvc2l0aW9uXCIgPSBhZGp1c3QgaW1hZ2UgcG9zaXRpb24gKHJlcXVpcmVzIHgsIHkpIHwgXCJzZXRfc2NhbGVcIiA9IHJlc2l6ZSBpbWFnZSAocmVxdWlyZXMgc3gsIHN5KSB8IFwic2V0X29wYWNpdHlcIiA9IGNoYW5nZSB0cmFuc3BhcmVuY3kgKHJlcXVpcmVzIG9wYWNpdHkpIHwgXCJzZXRfZGF0YVwiID0gbW9kaWZ5IGFueSBwcm9wZXJ0eSAocmVxdWlyZXMga2V5LCB2YWx1ZSknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBzZXRfcG9zaXRpb24gYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdIb3Jpem9udGFsIHBvc2l0aW9uIG9mZnNldCAoUkVRVUlSRUQgZm9yIHNldF9wb3NpdGlvbikuIFBpeGVscyBmcm9tIGNlbnRlci4gUG9zaXRpdmUgPSByaWdodCwgbmVnYXRpdmUgPSBsZWZ0LiBFeGFtcGxlczogMTAwIG1vdmVzIHJpZ2h0LCAtNTAgbW92ZXMgbGVmdC4gVXNlIGZvciBwcmVjaXNlIGltYWdlIGFsaWdubWVudCB3aXRoIHNjZW5lIGVsZW1lbnRzLidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgeToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ZlcnRpY2FsIHBvc2l0aW9uIG9mZnNldCAoUkVRVUlSRUQgZm9yIHNldF9wb3NpdGlvbikuIFBpeGVscyBmcm9tIGNlbnRlci4gUG9zaXRpdmUgPSB1cCwgbmVnYXRpdmUgPSBkb3duLiBFeGFtcGxlczogMjAwIG1vdmVzIHVwLCAtMTAwIG1vdmVzIGRvd24uIENvb3JkaW5hdGUgc3lzdGVtIGZvbGxvd3MgQ29jb3MgQ3JlYXRvciBjb252ZW50aW9uLidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHNldF9zY2FsZSBhY3Rpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgc3g6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdIb3Jpem9udGFsIHNjYWxlIG11bHRpcGxpZXIgKFJFUVVJUkVEIGZvciBzZXRfc2NhbGUpLiBSYW5nZTogMC4xLTEwLjAuIDEuMCA9IG9yaWdpbmFsIHNpemUsIDAuNSA9IGhhbGYgc2l6ZSwgMi4wID0gZG91YmxlIHNpemUuIEV4YW1wbGVzOiAwLjggZm9yIHNtYWxsZXIgb3ZlcmxheSwgMS4yIGZvciBzbGlnaHRseSBsYXJnZXIgcmVmZXJlbmNlLicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiAwLjEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhpbXVtOiAxMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzeToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ZlcnRpY2FsIHNjYWxlIG11bHRpcGxpZXIgKFJFUVVJUkVEIGZvciBzZXRfc2NhbGUpLiBSYW5nZTogMC4xLTEwLjAuIDEuMCA9IG9yaWdpbmFsIHNpemUsIDAuNSA9IGhhbGYgc2l6ZSwgMi4wID0gZG91YmxlIHNpemUuIFVzdWFsbHkgbWF0Y2hlcyBzeCBmb3IgcHJvcG9ydGlvbmFsIHNjYWxpbmcuIFNldCBkaWZmZXJlbnQgdmFsdWVzIGZvciBhc3BlY3QgcmF0aW8gYWRqdXN0bWVudC4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWluaW11bTogMC4xLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogMTBcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHNldF9vcGFjaXR5IGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVHJhbnNwYXJlbmN5IGxldmVsIChSRVFVSVJFRCBmb3Igc2V0X29wYWNpdHkpLiBSYW5nZTogMC4wLTEuMC4gMC4wID0gaW52aXNpYmxlLCAxLjAgPSBmdWxseSBvcGFxdWUsIDAuNSA9IHNlbWktdHJhbnNwYXJlbnQuIFJlY29tbWVuZGVkOiAwLjMtMC43IGZvciBzdWJ0bGUgb3ZlcmxheSwgMC44LTEuMCBmb3IgY2xlYXIgcmVmZXJlbmNlLicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogMVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3Igc2V0X2RhdGEgYWN0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IG5hbWUgdG8gbW9kaWZ5IChSRVFVSVJFRCBmb3Igc2V0X2RhdGEpLiBBdmFpbGFibGUga2V5czogXCJwYXRoXCIgKGltYWdlIGZpbGUpLCBcInhcIiAoaG9yaXpvbnRhbCBwb3NpdGlvbiksIFwieVwiICh2ZXJ0aWNhbCBwb3NpdGlvbiksIFwic3hcIiAoaG9yaXpvbnRhbCBzY2FsZSksIFwic3lcIiAodmVydGljYWwgc2NhbGUpLCBcIm9wYWNpdHlcIiAodHJhbnNwYXJlbmN5KS4gVXNlIGZvciBwcm9ncmFtbWF0aWMgcHJvcGVydHkgdXBkYXRlcy4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydwYXRoJywgJ3gnLCAneScsICdzeCcsICdzeScsICdvcGFjaXR5J11cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvcGVydHkgdmFsdWUgdG8gYXNzaWduIChSRVFVSVJFRCBmb3Igc2V0X2RhdGEpLiBUeXBlIHZhcmllcyBieSBrZXk6IHN0cmluZyBmb3IgXCJwYXRoXCIgKGZpbGUgcGF0aCksIG51bWJlciBmb3IgcG9zaXRpb24vc2NhbGUvb3BhY2l0eS4gRXhhbXBsZXM6IFwiL25ldy9wYXRoLnBuZ1wiIGZvciBwYXRoLCAxNTAgZm9yIHgveSwgMS41IGZvciBzeC9zeSwgMC43IGZvciBvcGFjaXR5LidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIC8vIDQuIFJlZmVyZW5jZSBJbWFnZSBEaXNwbGF5IC0gUmVmcmVzaCBhbmQgdXRpbGl0aWVzXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdyZWZlcmVuY2VfaW1hZ2VfZGlzcGxheScsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1JFRkVSRU5DRSBJTUFHRSBESVNQTEFZOiBVcGRhdGUgYW5kIHJlZnJlc2ggcmVmZXJlbmNlIGltYWdlIHJlbmRlcmluZyBpbiB0aGUgc2NlbmUgdmlldy4gVVNBR0U6IFwicmVmcmVzaFwiIHRvIGZvcmNlIGRpc3BsYXkgdXBkYXRlIGFmdGVyIGNoYW5nZXMgb3Igd2hlbiBpbWFnZXMgYXBwZWFyIGNvcnJ1cHRlZC4gVXNlIHdoZW4gcmVmZXJlbmNlIGltYWdlcyBkb25cXCd0IGRpc3BsYXkgY29ycmVjdGx5IG9yIGFmdGVyIHN5c3RlbSBjaGFuZ2VzLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsncmVmcmVzaCddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdEaXNwbGF5IG9wZXJhdGlvbjogXCJyZWZyZXNoXCIgPSBmb3JjZSB1cGRhdGUgcmVmZXJlbmNlIGltYWdlIHJlbmRlcmluZyBhbmQgdmlzaWJpbGl0eSAobm8gcGFyYW1ldGVycyBuZWVkZWQpLiBVc2Ugd2hlbiBpbWFnZXMgZG9uXFwndCBhcHBlYXIgb3IgZGlzcGxheSBpbmNvcnJlY3RseS4nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICBdO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGV4ZWN1dGUodG9vbE5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBzd2l0Y2ggKHRvb2xOYW1lKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ3JlZmVyZW5jZV9pbWFnZV9tYW5hZ2VtZW50JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUltYWdlTWFuYWdlbWVudChhcmdzKTtcclxuICAgICAgICAgICAgY2FzZSAncmVmZXJlbmNlX2ltYWdlX3F1ZXJ5JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUltYWdlUXVlcnkoYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3JlZmVyZW5jZV9pbWFnZV90cmFuc2Zvcm0nOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuaGFuZGxlSW1hZ2VUcmFuc2Zvcm0oYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3JlZmVyZW5jZV9pbWFnZV9kaXNwbGF5JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUltYWdlRGlzcGxheShhcmdzKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0b29sOiAke3Rvb2xOYW1lfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGFkZFJlZmVyZW5jZUltYWdlKHBhdGhzOiBzdHJpbmdbXSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgLy8g6aqM6K+B6Lev5b6E5qC85byPXHJcbiAgICAgICAgY29uc3QgaW52YWxpZFBhdGhzID0gcGF0aHMuZmlsdGVyKHBhdGggPT4gIXBhdGggfHwgdHlwZW9mIHBhdGggIT09ICdzdHJpbmcnKTtcclxuICAgICAgICBpZiAoaW52YWxpZFBhdGhzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBJbnZhbGlkIHBhdGhzIHByb3ZpZGVkOiAke2ludmFsaWRQYXRocy5qb2luKCcsICcpfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdhZGQtaW1hZ2UnLCBwYXRocyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGFkZGVkUGF0aHM6IHBhdGhzLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiBwYXRocy5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEFkZGVkICR7cGF0aHMubGVuZ3RofSByZWZlcmVuY2UgaW1hZ2UocylgXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgLy8g5aKe5by66ZSZ6K+v5L+h5oGvXHJcbiAgICAgICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcclxuICAgICAgICAgICAgaWYgKGVyci5tZXNzYWdlLmluY2x1ZGVzKCdub3QgZm91bmQnKSB8fCBlcnIubWVzc2FnZS5pbmNsdWRlcygnbm90IGV4aXN0JykpIHtcclxuICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZSA9IGBJbWFnZSBmaWxlIG5vdCBmb3VuZDogJHtwYXRocy5qb2luKCcsICcpfS4gUGxlYXNlIGNoZWNrIGlmIHRoZSBmaWxlIGV4aXN0cyBhbmQgdGhlIHBhdGggaXMgY29ycmVjdC5gO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVyci5tZXNzYWdlLmluY2x1ZGVzKCdwZXJtaXNzaW9uJykpIHtcclxuICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZSA9IGBQZXJtaXNzaW9uIGRlbmllZCBhY2Nlc3NpbmcgaW1hZ2UgZmlsZXM6ICR7cGF0aHMuam9pbignLCAnKX0uIFBsZWFzZSBjaGVjayBmaWxlIHBlcm1pc3Npb25zLmA7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXJyLm1lc3NhZ2UuaW5jbHVkZXMoJ2Zvcm1hdCcpKSB7XHJcbiAgICAgICAgICAgICAgICBlcnJvck1lc3NhZ2UgPSBgVW5zdXBwb3J0ZWQgaW1hZ2UgZm9ybWF0OiAke3BhdGhzLmpvaW4oJywgJyl9LiBQbGVhc2UgdXNlIHN1cHBvcnRlZCBmb3JtYXRzIChQTkcsIEpQRywgSlBFRykuYDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yTWVzc2FnZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBmYWlsZWRQYXRoczogcGF0aHMsXHJcbiAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbjogJ1BsZWFzZSB2ZXJpZnkgdGhlIGltYWdlIHBhdGhzIGFuZCBmaWxlIGV4aXN0ZW5jZS4nXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVtb3ZlUmVmZXJlbmNlSW1hZ2UocGF0aHM/OiBzdHJpbmdbXSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3JlbW92ZS1pbWFnZScsIHBhdGhzKTtcclxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHBhdGhzICYmIHBhdGhzLmxlbmd0aCA+IDAgP1xyXG4gICAgICAgICAgICAgICAgYFJlbW92ZWQgJHtwYXRocy5sZW5ndGh9IHJlZmVyZW5jZSBpbWFnZShzKWAgOlxyXG4gICAgICAgICAgICAgICAgJ1JlbW92ZWQgY3VycmVudCByZWZlcmVuY2UgaW1hZ2UnO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc3dpdGNoUmVmZXJlbmNlSW1hZ2UocGF0aDogc3RyaW5nLCBzY2VuZVVVSUQ/OiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIC8vIOmqjOivgei3r+W+hOagvOW8j1xyXG4gICAgICAgIGlmICghcGF0aCB8fCB0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdJbnZhbGlkIGltYWdlIHBhdGggcHJvdmlkZWQuIFBsZWFzZSBwcm92aWRlIGEgdmFsaWQgZmlsZSBwYXRoLidcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBzY2VuZVVVSUQgPyBbcGF0aCwgc2NlbmVVVUlEXSA6IFtwYXRoXTtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAnc3dpdGNoLWltYWdlJywgLi4uYXJncyk7XHJcbiAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuacieitpuWRiuS/oeaBr1xyXG4gICAgICAgICAgICBjb25zdCBoYXNXYXJuaW5nID0gcmVzdWx0ICYmIChyZXN1bHQud2FybmluZyB8fCByZXN1bHQubWVzc2FnZT8uaW5jbHVkZXMoJ2JsYW5rJykgfHwgcmVzdWx0Lm1lc3NhZ2U/LmluY2x1ZGVzKCdub3QgZm91bmQnKSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBwYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgIHNjZW5lVVVJRDogc2NlbmVVVUlELFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBTd2l0Y2hlZCB0byByZWZlcmVuY2UgaW1hZ2U6ICR7cGF0aH1gLFxyXG4gICAgICAgICAgICAgICAgICAgIHdhcm5pbmc6IGhhc1dhcm5pbmcgPyAnSW1hZ2UgbWF5IGJlIGJsYW5rIG9yIG5vdCBmb3VuZC4gUGxlYXNlIHZlcmlmeSB0aGUgaW1hZ2UgZmlsZSBleGlzdHMuJyA6IHVuZGVmaW5lZFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHdhcm5pbmc6IGhhc1dhcm5pbmcgPyAnSW1hZ2UgbWF5IGJlIGJsYW5rIG9yIG5vdCBmb3VuZC4gUGxlYXNlIHZlcmlmeSB0aGUgaW1hZ2UgZmlsZSBleGlzdHMuJyA6IHVuZGVmaW5lZFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIGxldCBlcnJvck1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcclxuICAgICAgICAgICAgaWYgKGVyci5tZXNzYWdlLmluY2x1ZGVzKCdub3QgZm91bmQnKSB8fCBlcnIubWVzc2FnZS5pbmNsdWRlcygnbm90IGV4aXN0JykpIHtcclxuICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZSA9IGBJbWFnZSBmaWxlIG5vdCBmb3VuZDogJHtwYXRofS4gUGxlYXNlIGNoZWNrIGlmIHRoZSBmaWxlIGV4aXN0cyBhbmQgdGhlIHBhdGggaXMgY29ycmVjdC5gO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVyci5tZXNzYWdlLmluY2x1ZGVzKCdwZXJtaXNzaW9uJykpIHtcclxuICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZSA9IGBQZXJtaXNzaW9uIGRlbmllZCBhY2Nlc3NpbmcgaW1hZ2UgZmlsZTogJHtwYXRofS4gUGxlYXNlIGNoZWNrIGZpbGUgcGVybWlzc2lvbnMuYDtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChlcnIubWVzc2FnZS5pbmNsdWRlcygnZm9ybWF0JykpIHtcclxuICAgICAgICAgICAgICAgIGVycm9yTWVzc2FnZSA9IGBVbnN1cHBvcnRlZCBpbWFnZSBmb3JtYXQ6ICR7cGF0aH0uIFBsZWFzZSB1c2Ugc3VwcG9ydGVkIGZvcm1hdHMgKFBORywgSlBHLCBKUEVHKS5gO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3JNZXNzYWdlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGZhaWxlZFBhdGg6IHBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbjogJ1BsZWFzZSB2ZXJpZnkgdGhlIGltYWdlIHBhdGggYW5kIGZpbGUgZXhpc3RlbmNlLidcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRSZWZlcmVuY2VJbWFnZURhdGEoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdzZXQtaW1hZ2UtZGF0YScsIGtleSwgdmFsdWUpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBrZXk6IGtleSxcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFJlZmVyZW5jZSBpbWFnZSAke2tleX0gc2V0IHRvICR7dmFsdWV9YFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeVJlZmVyZW5jZUltYWdlQ29uZmlnKCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgY29uZmlnOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAncXVlcnktY29uZmlnJyk7XHJcbiAgICAgICAgICAgIC8vIOaVsOaNruS4gOiHtOaAp+ajgOafpVxyXG4gICAgICAgICAgICBjb25zdCBjb25zaXN0ZW5jeUlzc3VlcyA9IHRoaXMuY2hlY2tEYXRhQ29uc2lzdGVuY3koY29uZmlnKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIC4uLmNvbmZpZyxcclxuICAgICAgICAgICAgICAgICAgICBkYXRhQ29uc2lzdGVuY3k6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNzdWVzOiBjb25zaXN0ZW5jeUlzc3VlcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzSXNzdWVzOiBjb25zaXN0ZW5jeUlzc3Vlcy5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHdhcm5pbmc6IGNvbnNpc3RlbmN5SXNzdWVzLmxlbmd0aCA+IDAgP1xyXG4gICAgICAgICAgICAgICAgICAgIGBEYXRhIGNvbnNpc3RlbmN5IGlzc3VlcyBkZXRlY3RlZDogJHtjb25zaXN0ZW5jeUlzc3Vlcy5qb2luKCcsICcpfWAgOiB1bmRlZmluZWRcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY2hlY2tEYXRhQ29uc2lzdGVuY3koY29uZmlnOiBhbnkpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghY29uZmlnKSB7XHJcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdObyBjb25maWd1cmF0aW9uIGRhdGEgYXZhaWxhYmxlJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBpc3N1ZXM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmo4Dmn6XphY3nva7kuK3nmoTlm77niYfliJfooahcclxuICAgICAgICBpZiAoY29uZmlnLmltYWdlcyAmJiBBcnJheS5pc0FycmF5KGNvbmZpZy5pbWFnZXMpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRlbGV0ZWRJbWFnZXMgPSBjb25maWcuaW1hZ2VzLmZpbHRlcigoaW1nOiBhbnkpID0+IFxyXG4gICAgICAgICAgICAgICAgaW1nLnBhdGggJiYgKGltZy5wYXRoLmluY2x1ZGVzKCdkZWxldGVkJykgfHwgaW1nLnBhdGguaW5jbHVkZXMoJ25vbmV4aXN0ZW50JykpXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoZGVsZXRlZEltYWdlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBpc3N1ZXMucHVzaChgRm91bmQgJHtkZWxldGVkSW1hZ2VzLmxlbmd0aH0gZGVsZXRlZC9ub25leGlzdGVudCBpbWFnZXMgaW4gY29uZmlndXJhdGlvbmApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDmo4Dmn6XlvZPliY3lm77niYfmmK/lkKblnKjliJfooajkuK1cclxuICAgICAgICAgICAgaWYgKGNvbmZpZy5jdXJyZW50ICYmICFjb25maWcuaW1hZ2VzLmZpbmQoKGltZzogYW55KSA9PiBpbWcucGF0aCA9PT0gY29uZmlnLmN1cnJlbnQpKSB7XHJcbiAgICAgICAgICAgICAgICBpc3N1ZXMucHVzaCgnQ3VycmVudCBpbWFnZSBub3QgZm91bmQgaW4gaW1hZ2UgbGlzdCcpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDmo4Dmn6Xph43lpI3nmoTlm77niYfot6/lvoRcclxuICAgICAgICAgICAgY29uc3QgcGF0aHMgPSBjb25maWcuaW1hZ2VzLm1hcCgoaW1nOiBhbnkpID0+IGltZy5wYXRoKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICAgICAgICAgIGNvbnN0IHVuaXF1ZVBhdGhzID0gbmV3IFNldChwYXRocyk7XHJcbiAgICAgICAgICAgIGlmIChwYXRocy5sZW5ndGggIT09IHVuaXF1ZVBhdGhzLnNpemUpIHtcclxuICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdEdXBsaWNhdGUgaW1hZ2UgcGF0aHMgZm91bmQgaW4gY29uZmlndXJhdGlvbicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDmo4Dmn6XlvZPliY3lm77niYforr7nva5cclxuICAgICAgICBpZiAoY29uZmlnLmN1cnJlbnQgJiYgdHlwZW9mIGNvbmZpZy5jdXJyZW50ICE9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnSW52YWxpZCBjdXJyZW50IGltYWdlIHBhdGggZm9ybWF0Jyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gaXNzdWVzO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlDdXJyZW50UmVmZXJlbmNlSW1hZ2UoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAncXVlcnktY3VycmVudCcpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IGN1cnJlbnRcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVmcmVzaFJlZmVyZW5jZUltYWdlKCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3JlZnJlc2gnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUmVmZXJlbmNlIGltYWdlIHJlZnJlc2hlZCdcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0UmVmZXJlbmNlSW1hZ2VQb3NpdGlvbih4OiBudW1iZXIsIHk6IG51bWJlcik6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3NldC1pbWFnZS1kYXRhJywgJ3gnLCB4KTtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3NldC1pbWFnZS1kYXRhJywgJ3knLCB5KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIHg6IHgsXHJcbiAgICAgICAgICAgICAgICAgICAgeTogeSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgUmVmZXJlbmNlIGltYWdlIHBvc2l0aW9uIHNldCB0byAoJHt4fSwgJHt5fSlgXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldFJlZmVyZW5jZUltYWdlU2NhbGUoc3g6IG51bWJlciwgc3k6IG51bWJlcik6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncmVmZXJlbmNlLWltYWdlJywgJ3NldC1pbWFnZS1kYXRhJywgJ3N4Jywgc3gpO1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAnc2V0LWltYWdlLWRhdGEnLCAnc3knLCBzeSk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBzeDogc3gsXHJcbiAgICAgICAgICAgICAgICAgICAgc3k6IHN5LFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBSZWZlcmVuY2UgaW1hZ2Ugc2NhbGUgc2V0IHRvICgke3N4fSwgJHtzeX0pYFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRSZWZlcmVuY2VJbWFnZU9wYWNpdHkob3BhY2l0eTogbnVtYmVyKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdyZWZlcmVuY2UtaW1hZ2UnLCAnc2V0LWltYWdlLWRhdGEnLCAnb3BhY2l0eScsIG9wYWNpdHkpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiBvcGFjaXR5LFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBSZWZlcmVuY2UgaW1hZ2Ugb3BhY2l0eSBzZXQgdG8gJHtvcGFjaXR5fWBcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgbGlzdFJlZmVyZW5jZUltYWdlcygpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdxdWVyeS1jb25maWcnKTtcclxuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdxdWVyeS1jdXJyZW50Jyk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25maWc6IGNvbmZpZyxcclxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiBjdXJyZW50LFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdSZWZlcmVuY2UgaW1hZ2UgaW5mb3JtYXRpb24gcmV0cmlldmVkJ1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjbGVhckFsbFJlZmVyZW5jZUltYWdlcygpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIFJlbW92ZSBhbGwgcmVmZXJlbmNlIGltYWdlcyBieSBjYWxsaW5nIHJlbW92ZS1pbWFnZSB3aXRob3V0IHBhdGhzXHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3JlZmVyZW5jZS1pbWFnZScsICdyZW1vdmUtaW1hZ2UnKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0FsbCByZWZlcmVuY2UgaW1hZ2VzIGNsZWFyZWQnXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBOZXcgaGFuZGxlciBtZXRob2RzIGZvciBvcHRpbWl6ZWQgdG9vbHNcclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSW1hZ2VNYW5hZ2VtZW50KGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24gfSA9IGFyZ3M7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnYWRkJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFkZFJlZmVyZW5jZUltYWdlKGFyZ3MucGF0aHMpO1xyXG4gICAgICAgICAgICBjYXNlICdyZW1vdmUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucmVtb3ZlUmVmZXJlbmNlSW1hZ2UoYXJncy5yZW1vdmVQYXRocyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3N3aXRjaCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zd2l0Y2hSZWZlcmVuY2VJbWFnZShhcmdzLnBhdGgsIGFyZ3Muc2NlbmVVVUlEKTtcclxuICAgICAgICAgICAgY2FzZSAnY2xlYXJfYWxsJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNsZWFyQWxsUmVmZXJlbmNlSW1hZ2VzKCk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGltYWdlIG1hbmFnZW1lbnQgYWN0aW9uOiAke2FjdGlvbn1gIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSW1hZ2VRdWVyeShhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHsgYWN0aW9uIH0gPSBhcmdzO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaCAoYWN0aW9uKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ2dldF9jb25maWcnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlSZWZlcmVuY2VJbWFnZUNvbmZpZygpO1xyXG4gICAgICAgICAgICBjYXNlICdnZXRfY3VycmVudCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5xdWVyeUN1cnJlbnRSZWZlcmVuY2VJbWFnZSgpO1xyXG4gICAgICAgICAgICBjYXNlICdsaXN0X2FsbCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5saXN0UmVmZXJlbmNlSW1hZ2VzKCk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGltYWdlIHF1ZXJ5IGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUltYWdlVHJhbnNmb3JtKGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24gfSA9IGFyZ3M7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnc2V0X3Bvc2l0aW9uJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNldFJlZmVyZW5jZUltYWdlUG9zaXRpb24oYXJncy54LCBhcmdzLnkpO1xyXG4gICAgICAgICAgICBjYXNlICdzZXRfc2NhbGUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuc2V0UmVmZXJlbmNlSW1hZ2VTY2FsZShhcmdzLnN4LCBhcmdzLnN5KTtcclxuICAgICAgICAgICAgY2FzZSAnc2V0X29wYWNpdHknOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuc2V0UmVmZXJlbmNlSW1hZ2VPcGFjaXR5KGFyZ3Mub3BhY2l0eSk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NldF9kYXRhJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNldFJlZmVyZW5jZUltYWdlRGF0YShhcmdzLmtleSwgYXJncy52YWx1ZSk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGltYWdlIHRyYW5zZm9ybSBhY3Rpb246ICR7YWN0aW9ufWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVJbWFnZURpc3BsYXkoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdyZWZyZXNoJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJlZnJlc2hSZWZlcmVuY2VJbWFnZSgpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBpbWFnZSBkaXNwbGF5IGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbn0iXX0=