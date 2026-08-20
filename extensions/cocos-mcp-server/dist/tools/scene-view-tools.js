"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneViewTools = void 0;
class SceneViewTools {
    getTools() {
        return [
            {
                name: 'scene_view_gizmo_management',
                description: 'GIZMO MANAGEMENT: Control scene manipulation tools and transformation handles. USAGE: Change between position/rotation/scale tools, switch coordinate systems (local/global), adjust pivot points. Essential for precise scene editing and object manipulation in the editor.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            description: 'Gizmo operation to perform. Query actions get current state, change actions modify settings.',
                            enum: ['change_tool', 'query_tool', 'change_pivot', 'query_pivot', 'change_coordinate', 'query_coordinate', 'query_view_mode']
                        },
                        toolName: {
                            type: 'string',
                            description: 'Transformation tool type (REQUIRED for change_tool action). "position" = move objects, "rotation" = rotate objects, "scale" = resize objects, "rect" = 2D rect transform. Choose based on desired editing operation.',
                            enum: ['position', 'rotation', 'scale', 'rect']
                        },
                        pivotName: {
                            type: 'string',
                            description: 'Transform pivot point (REQUIRED for change_pivot action). "pivot" = use object\'s pivot point (local center), "center" = use geometric center (bounding box center). Affects rotation and scaling behavior.',
                            enum: ['pivot', 'center']
                        },
                        coordinateType: {
                            type: 'string',
                            description: 'Coordinate system reference (REQUIRED for change_coordinate action). "local" = relative to object\'s orientation, "global" = relative to world axes. Local useful for object-oriented editing, global for world-aligned operations.',
                            enum: ['local', 'global']
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'scene_view_mode_control',
                description: 'VIEW MODE CONTROL: Switch scene editor between 2D and 3D modes and control visual aids. USAGE: Toggle 2D/3D perspective for different editing contexts, show/hide grid for alignment reference. 2D mode for UI/sprite editing, 3D mode for 3D scene construction.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            description: 'View control operation. Change actions modify view state, query actions get current state.',
                            enum: ['change_2d_3d', 'query_2d_3d', 'set_grid', 'query_grid']
                        },
                        is2D: {
                            type: 'boolean',
                            description: 'View mode setting (REQUIRED for change_2d_3d action). true = 2D orthographic view (for UI, sprites, 2D games), false = 3D perspective view (for 3D scenes, spatial editing). Choose based on content type.'
                        },
                        gridVisible: {
                            type: 'boolean',
                            description: 'Grid display state (REQUIRED for set_grid action). true = show alignment grid (helpful for positioning), false = hide grid (cleaner view for final preview). Grid aids in precise object placement and alignment.'
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'scene_view_icon_gizmo',
                description: 'ICON GIZMO CONTROL: Configure visual representation of scene nodes and components. USAGE: Adjust icon display mode (2D/3D) and size for better visibility. Useful for managing visual clutter and improving scene navigation when working with many objects.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            description: 'Icon gizmo operation. Set actions modify appearance, query actions get current settings.',
                            enum: ['set_3d_mode', 'query_3d_mode', 'set_size', 'query_size']
                        },
                        is3D: {
                            type: 'boolean',
                            description: 'Icon display mode (REQUIRED for set_3d_mode action). true = 3D icons (spatial representation), false = 2D icons (flat representation). 3D mode for spatial awareness, 2D mode for reduced visual complexity.'
                        },
                        size: {
                            type: 'number',
                            description: 'Icon size scale (REQUIRED for set_size action). Range: 10-100. Smaller values = less visual noise, larger values = easier selection. Recommended: 20-30 for dense scenes, 40-60 for sparse scenes. Adjust based on scene complexity.',
                            minimum: 10,
                            maximum: 100
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'scene_view_camera_control',
                description: 'CAMERA CONTROL: Navigate and position the scene view camera for better editing workflow. USAGE: Focus on specific objects, align camera angles, and synchronize view positions. Essential for efficient scene navigation and precise editing of complex scenes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            description: 'Camera operation: "focus_on_nodes" = center view on specific nodes (requires nodeUuids) | "align_camera_with_view" = sync camera to current view | "align_view_with_node" = position view to match node orientation.',
                            enum: ['focus_on_nodes', 'align_camera_with_view', 'align_view_with_node']
                        },
                        nodeUuids: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Node UUIDs to focus on (REQUIRED for focus_on_nodes action). Array of node UUIDs to center in view. Use node_query to get UUIDs first. Examples: ["node-uuid-1", "node-uuid-2"]. Empty array [] focuses on all scene nodes. Format: array of UUID strings.'
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'scene_view_status_management',
                description: 'STATUS MANAGEMENT: Monitor scene view configuration and restore default settings. USAGE: "get_status" for comprehensive view state information, "reset_view" to restore default camera position and settings. Useful for troubleshooting view issues and standardizing editor state.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            description: 'Status operation: "get_status" = retrieve current scene view configuration and settings | "reset_view" = restore scene view to default camera position and settings (no parameters needed).',
                            enum: ['get_status', 'reset_view']
                        }
                    },
                    required: ['action']
                }
            }
        ];
    }
    async execute(toolName, args) {
        switch (toolName) {
            case 'scene_view_gizmo_management':
                return await this.handleGizmoManagement(args);
            case 'scene_view_mode_control':
                return await this.handleViewModeControl(args);
            case 'scene_view_icon_gizmo':
                return await this.handleIconGizmo(args);
            case 'scene_view_camera_control':
                return await this.handleCameraControl(args);
            case 'scene_view_status_management':
                return await this.handleStatusManagement(args);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    async handleGizmoManagement(args) {
        const { action, toolName, pivotName, coordinateType } = args;
        switch (action) {
            case 'change_tool':
                if (!toolName) {
                    return { success: false, error: 'toolName is required for change_tool action' };
                }
                return await this.changeGizmoTool(toolName);
            case 'query_tool':
                return await this.queryGizmoToolName();
            case 'change_pivot':
                if (!pivotName) {
                    return { success: false, error: 'pivotName is required for change_pivot action' };
                }
                return await this.changeGizmoPivot(pivotName);
            case 'query_pivot':
                return await this.queryGizmoPivot();
            case 'change_coordinate':
                if (!coordinateType) {
                    return { success: false, error: 'coordinateType is required for change_coordinate action' };
                }
                return await this.changeGizmoCoordinate(coordinateType);
            case 'query_coordinate':
                return await this.queryGizmoCoordinate();
            case 'query_view_mode':
                return await this.queryGizmoViewMode();
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }
    async handleViewModeControl(args) {
        const { action, is2D, gridVisible } = args;
        switch (action) {
            case 'change_2d_3d':
                if (is2D === undefined) {
                    return { success: false, error: 'is2D is required for change_2d_3d action' };
                }
                return await this.changeViewMode2D3D(is2D);
            case 'query_2d_3d':
                return await this.queryViewMode2D3D();
            case 'set_grid':
                if (gridVisible === undefined) {
                    return { success: false, error: 'gridVisible is required for set_grid action' };
                }
                return await this.setGridVisible(gridVisible);
            case 'query_grid':
                return await this.queryGridVisible();
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }
    async handleIconGizmo(args) {
        const { action, is3D, size } = args;
        switch (action) {
            case 'set_3d_mode':
                if (is3D === undefined) {
                    return { success: false, error: 'is3D is required for set_3d_mode action' };
                }
                return await this.setIconGizmo3D(is3D);
            case 'query_3d_mode':
                return await this.queryIconGizmo3D();
            case 'set_size':
                if (size === undefined) {
                    return { success: false, error: 'size is required for set_size action' };
                }
                return await this.setIconGizmoSize(size);
            case 'query_size':
                return await this.queryIconGizmoSize();
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }
    async handleCameraControl(args) {
        const { action, nodeUuids } = args;
        switch (action) {
            case 'focus_on_nodes':
                return await this.focusCameraOnNodes(nodeUuids || []);
            case 'align_camera_with_view':
                return await this.alignCameraWithView();
            case 'align_view_with_node':
                return await this.alignViewWithNode();
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }
    async handleStatusManagement(args) {
        const { action } = args;
        switch (action) {
            case 'get_status':
                return await this.getSceneViewStatus();
            case 'reset_view':
                return await this.resetSceneView();
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    }
    // Private implementation methods
    async changeGizmoTool(name) {
        try {
            await Editor.Message.request('scene', 'change-gizmo-tool', name);
            return {
                success: true,
                message: `Gizmo tool changed to '${name}'`,
                data: { toolName: name }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryGizmoToolName() {
        try {
            const toolName = await Editor.Message.request('scene', 'query-gizmo-tool-name');
            return {
                success: true,
                data: {
                    currentTool: toolName,
                    message: `Current Gizmo tool: ${toolName}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async changeGizmoPivot(name) {
        try {
            await Editor.Message.request('scene', 'change-gizmo-pivot', name);
            return {
                success: true,
                message: `Gizmo pivot changed to '${name}'`,
                data: { pivotName: name }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryGizmoPivot() {
        try {
            const pivotName = await Editor.Message.request('scene', 'query-gizmo-pivot');
            return {
                success: true,
                data: {
                    currentPivot: pivotName,
                    message: `Current Gizmo pivot: ${pivotName}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryGizmoViewMode() {
        try {
            const viewMode = await Editor.Message.request('scene', 'query-gizmo-view-mode');
            return {
                success: true,
                data: {
                    viewMode: viewMode,
                    message: `Current view mode: ${viewMode}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async changeGizmoCoordinate(type) {
        try {
            await Editor.Message.request('scene', 'change-gizmo-coordinate', type);
            return {
                success: true,
                message: `Coordinate system changed to '${type}'`,
                data: { coordinateType: type }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryGizmoCoordinate() {
        try {
            const coordinate = await Editor.Message.request('scene', 'query-gizmo-coordinate');
            return {
                success: true,
                data: {
                    coordinate: coordinate,
                    message: `Current coordinate system: ${coordinate}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async changeViewMode2D3D(is2D) {
        try {
            await Editor.Message.request('scene', 'change-is2D', is2D);
            return {
                success: true,
                message: `View mode changed to ${is2D ? '2D' : '3D'}`,
                data: { is2D: is2D, viewMode: is2D ? '2D' : '3D' }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryViewMode2D3D() {
        try {
            const is2D = await Editor.Message.request('scene', 'query-is2D');
            return {
                success: true,
                data: {
                    is2D: is2D,
                    viewMode: is2D ? '2D' : '3D',
                    message: `Current view mode: ${is2D ? '2D' : '3D'}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async setGridVisible(visible) {
        try {
            await Editor.Message.request('scene', 'set-grid-visible', visible);
            return {
                success: true,
                message: `Grid ${visible ? 'shown' : 'hidden'}`,
                data: { gridVisible: visible }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryGridVisible() {
        try {
            const visible = await Editor.Message.request('scene', 'query-is-grid-visible');
            return {
                success: true,
                data: {
                    visible: visible,
                    message: `Grid is ${visible ? 'visible' : 'hidden'}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async setIconGizmo3D(is3D) {
        try {
            await Editor.Message.request('scene', 'set-icon-gizmo-3d', is3D);
            return {
                success: true,
                message: `IconGizmo set to ${is3D ? '3D' : '2D'} mode`,
                data: { is3D: is3D, mode: is3D ? '3D' : '2D' }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryIconGizmo3D() {
        try {
            const is3D = await Editor.Message.request('scene', 'query-is-icon-gizmo-3d');
            return {
                success: true,
                data: {
                    is3D: is3D,
                    mode: is3D ? '3D' : '2D',
                    message: `IconGizmo is in ${is3D ? '3D' : '2D'} mode`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async setIconGizmoSize(size) {
        try {
            await Editor.Message.request('scene', 'set-icon-gizmo-size', size);
            return {
                success: true,
                message: `IconGizmo size set to ${size}`,
                data: { size: size }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryIconGizmoSize() {
        try {
            const size = await Editor.Message.request('scene', 'query-icon-gizmo-size');
            return {
                success: true,
                data: {
                    size: size,
                    message: `IconGizmo size: ${size}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async focusCameraOnNodes(nodeUuids) {
        try {
            await Editor.Message.request('scene', 'focus-camera', nodeUuids);
            const message = nodeUuids.length === 0 ?
                'Camera focused on all nodes' :
                `Camera focused on ${nodeUuids.length} node(s)`;
            return {
                success: true,
                message: message,
                data: { focusedNodes: nodeUuids }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async alignCameraWithView() {
        try {
            await Editor.Message.request('scene', 'align-with-view');
            return {
                success: true,
                message: 'Scene camera aligned with current view'
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async alignViewWithNode() {
        try {
            await Editor.Message.request('scene', 'align-view-with-node');
            return {
                success: true,
                message: 'View aligned with selected node successfully'
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async getSceneViewStatus() {
        try {
            // Gather all view status information
            const [gizmoTool, gizmoPivot, gizmoCoordinate, viewMode2D3D, gridVisible, iconGizmo3D, iconGizmoSize] = await Promise.allSettled([
                this.queryGizmoToolName(),
                this.queryGizmoPivot(),
                this.queryGizmoCoordinate(),
                this.queryViewMode2D3D(),
                this.queryGridVisible(),
                this.queryIconGizmo3D(),
                this.queryIconGizmoSize()
            ]);
            const status = {
                timestamp: new Date().toISOString()
            };
            // Extract data from fulfilled promises
            if (gizmoTool.status === 'fulfilled' && gizmoTool.value.success) {
                status.gizmoTool = gizmoTool.value.data.currentTool;
            }
            if (gizmoPivot.status === 'fulfilled' && gizmoPivot.value.success) {
                status.gizmoPivot = gizmoPivot.value.data.currentPivot;
            }
            if (gizmoCoordinate.status === 'fulfilled' && gizmoCoordinate.value.success) {
                status.coordinate = gizmoCoordinate.value.data.coordinate;
            }
            if (viewMode2D3D.status === 'fulfilled' && viewMode2D3D.value.success) {
                status.is2D = viewMode2D3D.value.data.is2D;
                status.viewMode = viewMode2D3D.value.data.viewMode;
            }
            if (gridVisible.status === 'fulfilled' && gridVisible.value.success) {
                status.gridVisible = gridVisible.value.data.visible;
            }
            if (iconGizmo3D.status === 'fulfilled' && iconGizmo3D.value.success) {
                status.iconGizmo3D = iconGizmo3D.value.data.is3D;
            }
            if (iconGizmoSize.status === 'fulfilled' && iconGizmoSize.value.success) {
                status.iconGizmoSize = iconGizmoSize.value.data.size;
            }
            return {
                success: true,
                data: status,
                message: 'Scene view status retrieved successfully'
            };
        }
        catch (err) {
            return {
                success: false,
                error: `Failed to get scene view status: ${err.message}`
            };
        }
    }
    async resetSceneView() {
        try {
            // Reset scene view to default settings
            const resetActions = [
                this.changeGizmoTool('position'),
                this.changeGizmoPivot('pivot'),
                this.changeGizmoCoordinate('local'),
                this.changeViewMode2D3D(false), // 3D mode
                this.setGridVisible(true),
                this.setIconGizmo3D(true),
                this.setIconGizmoSize(60)
            ];
            await Promise.all(resetActions);
            return {
                success: true,
                message: 'Scene view reset to default settings',
                data: {
                    defaultSettings: {
                        gizmoTool: 'position',
                        gizmoPivot: 'pivot',
                        coordinate: 'local',
                        viewMode: '3D',
                        gridVisible: true,
                        iconGizmo3D: true,
                        iconGizmoSize: 60
                    }
                }
            };
        }
        catch (err) {
            return {
                success: false,
                error: `Failed to reset scene view: ${err.message}`
            };
        }
    }
}
exports.SceneViewTools = SceneViewTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtdmlldy10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9zY2VuZS12aWV3LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBLE1BQWEsY0FBYztJQUN2QixRQUFRO1FBQ0osT0FBTztZQUNIO2dCQUNJLElBQUksRUFBRSw2QkFBNkI7Z0JBQ25DLFdBQVcsRUFBRSwrUUFBK1E7Z0JBQzVSLFdBQVcsRUFBRTtvQkFDVCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUU7d0JBQ1IsTUFBTSxFQUFFOzRCQUNKLElBQUksRUFBRSxRQUFROzRCQUNkLFdBQVcsRUFBRSw4RkFBOEY7NEJBQzNHLElBQUksRUFBRSxDQUFDLGFBQWEsRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsQ0FBQzt5QkFDakk7d0JBQ0QsUUFBUSxFQUFFOzRCQUNOLElBQUksRUFBRSxRQUFROzRCQUNkLFdBQVcsRUFBRSxzTkFBc047NEJBQ25PLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQzt5QkFDbEQ7d0JBQ0QsU0FBUyxFQUFFOzRCQUNQLElBQUksRUFBRSxRQUFROzRCQUNkLFdBQVcsRUFBRSw2TUFBNk07NEJBQzFOLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUM7eUJBQzVCO3dCQUNELGNBQWMsRUFBRTs0QkFDWixJQUFJLEVBQUUsUUFBUTs0QkFDZCxXQUFXLEVBQUUscU9BQXFPOzRCQUNsUCxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDO3lCQUM1QjtxQkFDSjtvQkFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7aUJBQ3ZCO2FBQ0o7WUFDRDtnQkFDSSxJQUFJLEVBQUUseUJBQXlCO2dCQUMvQixXQUFXLEVBQUUsbVFBQW1RO2dCQUNoUixX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QUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRWhDLE9BQU87Z0JBQ0gsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsT0FBTyxFQUFFLHNDQUFzQztnQkFDL0MsSUFBSSxFQUFFO29CQUNGLGVBQWUsRUFBRTt3QkFDYixTQUFTLEVBQUUsVUFBVTt3QkFDckIsVUFBVSxFQUFFLE9BQU87d0JBQ25CLFVBQVUsRUFBRSxPQUFPO3dCQUNuQixRQUFRLEVBQUUsSUFBSTt3QkFDZCxXQUFXLEVBQUUsSUFBSTt3QkFDakIsV0FBVyxFQUFFLElBQUk7d0JBQ2pCLGFBQWEsRUFBRSxFQUFFO3FCQUNwQjtpQkFDSjthQUNKLENBQUM7UUFFTixDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPO2dCQUNILE9BQU8sRUFBRSxLQUFLO2dCQUNkLEtBQUssRUFBRSwrQkFBK0IsR0FBRyxDQUFDLE9BQU8sRUFBRTthQUN0RCxDQUFDO1FBQ04sQ0FBQztJQUNMLENBQUM7Q0FDSjtBQXJsQkQsd0NBcWxCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRvb2xEZWZpbml0aW9uLCBUb29sUmVzcG9uc2UsIFRvb2xFeGVjdXRvciB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBTY2VuZVZpZXdUb29scyBpbXBsZW1lbnRzIFRvb2xFeGVjdXRvciB7XHJcbiAgICBnZXRUb29scygpOiBUb29sRGVmaW5pdGlvbltdIHtcclxuICAgICAgICByZXR1cm4gW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19naXptb19tYW5hZ2VtZW50JyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnR0laTU8gTUFOQUdFTUVOVDogQ29udHJvbCBzY2VuZSBtYW5pcHVsYXRpb24gdG9vbHMgYW5kIHRyYW5zZm9ybWF0aW9uIGhhbmRsZXMuIFVTQUdFOiBDaGFuZ2UgYmV0d2VlbiBwb3NpdGlvbi9yb3RhdGlvbi9zY2FsZSB0b29scywgc3dpdGNoIGNvb3JkaW5hdGUgc3lzdGVtcyAobG9jYWwvZ2xvYmFsKSwgYWRqdXN0IHBpdm90IHBvaW50cy4gRXNzZW50aWFsIGZvciBwcmVjaXNlIHNjZW5lIGVkaXRpbmcgYW5kIG9iamVjdCBtYW5pcHVsYXRpb24gaW4gdGhlIGVkaXRvci4nLFxyXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0dpem1vIG9wZXJhdGlvbiB0byBwZXJmb3JtLiBRdWVyeSBhY3Rpb25zIGdldCBjdXJyZW50IHN0YXRlLCBjaGFuZ2UgYWN0aW9ucyBtb2RpZnkgc2V0dGluZ3MuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsnY2hhbmdlX3Rvb2wnLCAncXVlcnlfdG9vbCcsICdjaGFuZ2VfcGl2b3QnLCAncXVlcnlfcGl2b3QnLCAnY2hhbmdlX2Nvb3JkaW5hdGUnLCAncXVlcnlfY29vcmRpbmF0ZScsICdxdWVyeV92aWV3X21vZGUnXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sTmFtZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RyYW5zZm9ybWF0aW9uIHRvb2wgdHlwZSAoUkVRVUlSRUQgZm9yIGNoYW5nZV90b29sIGFjdGlvbikuIFwicG9zaXRpb25cIiA9IG1vdmUgb2JqZWN0cywgXCJyb3RhdGlvblwiID0gcm90YXRlIG9iamVjdHMsIFwic2NhbGVcIiA9IHJlc2l6ZSBvYmplY3RzLCBcInJlY3RcIiA9IDJEIHJlY3QgdHJhbnNmb3JtLiBDaG9vc2UgYmFzZWQgb24gZGVzaXJlZCBlZGl0aW5nIG9wZXJhdGlvbi4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydwb3NpdGlvbicsICdyb3RhdGlvbicsICdzY2FsZScsICdyZWN0J11cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGl2b3ROYW1lOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVHJhbnNmb3JtIHBpdm90IHBvaW50IChSRVFVSVJFRCBmb3IgY2hhbmdlX3Bpdm90IGFjdGlvbikuIFwicGl2b3RcIiA9IHVzZSBvYmplY3RcXCdzIHBpdm90IHBvaW50IChsb2NhbCBjZW50ZXIpLCBcImNlbnRlclwiID0gdXNlIGdlb21ldHJpYyBjZW50ZXIgKGJvdW5kaW5nIGJveCBjZW50ZXIpLiBBZmZlY3RzIHJvdGF0aW9uIGFuZCBzY2FsaW5nIGJlaGF2aW9yLicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ3Bpdm90JywgJ2NlbnRlciddXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvb3JkaW5hdGVUeXBlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ29vcmRpbmF0ZSBzeXN0ZW0gcmVmZXJlbmNlIChSRVFVSVJFRCBmb3IgY2hhbmdlX2Nvb3JkaW5hdGUgYWN0aW9uKS4gXCJsb2NhbFwiID0gcmVsYXRpdmUgdG8gb2JqZWN0XFwncyBvcmllbnRhdGlvbiwgXCJnbG9iYWxcIiA9IHJlbGF0aXZlIHRvIHdvcmxkIGF4ZXMuIExvY2FsIHVzZWZ1bCBmb3Igb2JqZWN0LW9yaWVudGVkIGVkaXRpbmcsIGdsb2JhbCBmb3Igd29ybGQtYWxpZ25lZCBvcGVyYXRpb25zLicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbJ2xvY2FsJywgJ2dsb2JhbCddXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X21vZGVfY29udHJvbCcsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ZJRVcgTU9ERSBDT05UUk9MOiBTd2l0Y2ggc2NlbmUgZWRpdG9yIGJldHdlZW4gMkQgYW5kIDNEIG1vZGVzIGFuZCBjb250cm9sIHZpc3VhbCBhaWRzLiBVU0FHRTogVG9nZ2xlIDJELzNEIHBlcnNwZWN0aXZlIGZvciBkaWZmZXJlbnQgZWRpdGluZyBjb250ZXh0cywgc2hvdy9oaWRlIGdyaWQgZm9yIGFsaWdubWVudCByZWZlcmVuY2UuIDJEIG1vZGUgZm9yIFVJL3Nwcml0ZSBlZGl0aW5nLCAzRCBtb2RlIGZvciAzRCBzY2VuZSBjb25zdHJ1Y3Rpb24uJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdWaWV3IGNvbnRyb2wgb3BlcmF0aW9uLiBDaGFuZ2UgYWN0aW9ucyBtb2RpZnkgdmlldyBzdGF0ZSwgcXVlcnkgYWN0aW9ucyBnZXQgY3VycmVudCBzdGF0ZS4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydjaGFuZ2VfMmRfM2QnLCAncXVlcnlfMmRfM2QnLCAnc2V0X2dyaWQnLCAncXVlcnlfZ3JpZCddXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzMkQ6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVmlldyBtb2RlIHNldHRpbmcgKFJFUVVJUkVEIGZvciBjaGFuZ2VfMmRfM2QgYWN0aW9uKS4gdHJ1ZSA9IDJEIG9ydGhvZ3JhcGhpYyB2aWV3IChmb3IgVUksIHNwcml0ZXMsIDJEIGdhbWVzKSwgZmFsc2UgPSAzRCBwZXJzcGVjdGl2ZSB2aWV3IChmb3IgM0Qgc2NlbmVzLCBzcGF0aWFsIGVkaXRpbmcpLiBDaG9vc2UgYmFzZWQgb24gY29udGVudCB0eXBlLidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZ3JpZFZpc2libGU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnR3JpZCBkaXNwbGF5IHN0YXRlIChSRVFVSVJFRCBmb3Igc2V0X2dyaWQgYWN0aW9uKS4gdHJ1ZSA9IHNob3cgYWxpZ25tZW50IGdyaWQgKGhlbHBmdWwgZm9yIHBvc2l0aW9uaW5nKSwgZmFsc2UgPSBoaWRlIGdyaWQgKGNsZWFuZXIgdmlldyBmb3IgZmluYWwgcHJldmlldykuIEdyaWQgYWlkcyBpbiBwcmVjaXNlIG9iamVjdCBwbGFjZW1lbnQgYW5kIGFsaWdubWVudC4nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X2ljb25fZ2l6bW8nLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJQ09OIEdJWk1PIENPTlRST0w6IENvbmZpZ3VyZSB2aXN1YWwgcmVwcmVzZW50YXRpb24gb2Ygc2NlbmUgbm9kZXMgYW5kIGNvbXBvbmVudHMuIFVTQUdFOiBBZGp1c3QgaWNvbiBkaXNwbGF5IG1vZGUgKDJELzNEKSBhbmQgc2l6ZSBmb3IgYmV0dGVyIHZpc2liaWxpdHkuIFVzZWZ1bCBmb3IgbWFuYWdpbmcgdmlzdWFsIGNsdXR0ZXIgYW5kIGltcHJvdmluZyBzY2VuZSBuYXZpZ2F0aW9uIHdoZW4gd29ya2luZyB3aXRoIG1hbnkgb2JqZWN0cy4nLFxyXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ljb24gZ2l6bW8gb3BlcmF0aW9uLiBTZXQgYWN0aW9ucyBtb2RpZnkgYXBwZWFyYW5jZSwgcXVlcnkgYWN0aW9ucyBnZXQgY3VycmVudCBzZXR0aW5ncy4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydzZXRfM2RfbW9kZScsICdxdWVyeV8zZF9tb2RlJywgJ3NldF9zaXplJywgJ3F1ZXJ5X3NpemUnXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpczNEOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ljb24gZGlzcGxheSBtb2RlIChSRVFVSVJFRCBmb3Igc2V0XzNkX21vZGUgYWN0aW9uKS4gdHJ1ZSA9IDNEIGljb25zIChzcGF0aWFsIHJlcHJlc2VudGF0aW9uKSwgZmFsc2UgPSAyRCBpY29ucyAoZmxhdCByZXByZXNlbnRhdGlvbikuIDNEIG1vZGUgZm9yIHNwYXRpYWwgYXdhcmVuZXNzLCAyRCBtb2RlIGZvciByZWR1Y2VkIHZpc3VhbCBjb21wbGV4aXR5LidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ljb24gc2l6ZSBzY2FsZSAoUkVRVUlSRUQgZm9yIHNldF9zaXplIGFjdGlvbikuIFJhbmdlOiAxMC0xMDAuIFNtYWxsZXIgdmFsdWVzID0gbGVzcyB2aXN1YWwgbm9pc2UsIGxhcmdlciB2YWx1ZXMgPSBlYXNpZXIgc2VsZWN0aW9uLiBSZWNvbW1lbmRlZDogMjAtMzAgZm9yIGRlbnNlIHNjZW5lcywgNDAtNjAgZm9yIHNwYXJzZSBzY2VuZXMuIEFkanVzdCBiYXNlZCBvbiBzY2VuZSBjb21wbGV4aXR5LicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiAxMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heGltdW06IDEwMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2NlbmVfdmlld19jYW1lcmFfY29udHJvbCcsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NBTUVSQSBDT05UUk9MOiBOYXZpZ2F0ZSBhbmQgcG9zaXRpb24gdGhlIHNjZW5lIHZpZXcgY2FtZXJhIGZvciBiZXR0ZXIgZWRpdGluZyB3b3JrZmxvdy4gVVNBR0U6IEZvY3VzIG9uIHNwZWNpZmljIG9iamVjdHMsIGFsaWduIGNhbWVyYSBhbmdsZXMsIGFuZCBzeW5jaHJvbml6ZSB2aWV3IHBvc2l0aW9ucy4gRXNzZW50aWFsIGZvciBlZmZpY2llbnQgc2NlbmUgbmF2aWdhdGlvbiBhbmQgcHJlY2lzZSBlZGl0aW5nIG9mIGNvbXBsZXggc2NlbmVzLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ2FtZXJhIG9wZXJhdGlvbjogXCJmb2N1c19vbl9ub2Rlc1wiID0gY2VudGVyIHZpZXcgb24gc3BlY2lmaWMgbm9kZXMgKHJlcXVpcmVzIG5vZGVVdWlkcykgfCBcImFsaWduX2NhbWVyYV93aXRoX3ZpZXdcIiA9IHN5bmMgY2FtZXJhIHRvIGN1cnJlbnQgdmlldyB8IFwiYWxpZ25fdmlld193aXRoX25vZGVcIiA9IHBvc2l0aW9uIHZpZXcgdG8gbWF0Y2ggbm9kZSBvcmllbnRhdGlvbi4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydmb2N1c19vbl9ub2RlcycsICdhbGlnbl9jYW1lcmFfd2l0aF92aWV3JywgJ2FsaWduX3ZpZXdfd2l0aF9ub2RlJ11cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWRzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTm9kZSBVVUlEcyB0byBmb2N1cyBvbiAoUkVRVUlSRUQgZm9yIGZvY3VzX29uX25vZGVzIGFjdGlvbikuIEFycmF5IG9mIG5vZGUgVVVJRHMgdG8gY2VudGVyIGluIHZpZXcuIFVzZSBub2RlX3F1ZXJ5IHRvIGdldCBVVUlEcyBmaXJzdC4gRXhhbXBsZXM6IFtcIm5vZGUtdXVpZC0xXCIsIFwibm9kZS11dWlkLTJcIl0uIEVtcHR5IGFycmF5IFtdIGZvY3VzZXMgb24gYWxsIHNjZW5lIG5vZGVzLiBGb3JtYXQ6IGFycmF5IG9mIFVVSUQgc3RyaW5ncy4nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdzY2VuZV92aWV3X3N0YXR1c19tYW5hZ2VtZW50JyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU1RBVFVTIE1BTkFHRU1FTlQ6IE1vbml0b3Igc2NlbmUgdmlldyBjb25maWd1cmF0aW9uIGFuZCByZXN0b3JlIGRlZmF1bHQgc2V0dGluZ3MuIFVTQUdFOiBcImdldF9zdGF0dXNcIiBmb3IgY29tcHJlaGVuc2l2ZSB2aWV3IHN0YXRlIGluZm9ybWF0aW9uLCBcInJlc2V0X3ZpZXdcIiB0byByZXN0b3JlIGRlZmF1bHQgY2FtZXJhIHBvc2l0aW9uIGFuZCBzZXR0aW5ncy4gVXNlZnVsIGZvciB0cm91Ymxlc2hvb3RpbmcgdmlldyBpc3N1ZXMgYW5kIHN0YW5kYXJkaXppbmcgZWRpdG9yIHN0YXRlLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3RhdHVzIG9wZXJhdGlvbjogXCJnZXRfc3RhdHVzXCIgPSByZXRyaWV2ZSBjdXJyZW50IHNjZW5lIHZpZXcgY29uZmlndXJhdGlvbiBhbmQgc2V0dGluZ3MgfCBcInJlc2V0X3ZpZXdcIiA9IHJlc3RvcmUgc2NlbmUgdmlldyB0byBkZWZhdWx0IGNhbWVyYSBwb3NpdGlvbiBhbmQgc2V0dGluZ3MgKG5vIHBhcmFtZXRlcnMgbmVlZGVkKS4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydnZXRfc3RhdHVzJywgJ3Jlc2V0X3ZpZXcnXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBleGVjdXRlKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgc3dpdGNoICh0b29sTmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlICdzY2VuZV92aWV3X2dpem1vX21hbmFnZW1lbnQnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuaGFuZGxlR2l6bW9NYW5hZ2VtZW50KGFyZ3MpO1xyXG4gICAgICAgICAgICBjYXNlICdzY2VuZV92aWV3X21vZGVfY29udHJvbCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5oYW5kbGVWaWV3TW9kZUNvbnRyb2woYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NjZW5lX3ZpZXdfaWNvbl9naXptbyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5oYW5kbGVJY29uR2l6bW8oYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NjZW5lX3ZpZXdfY2FtZXJhX2NvbnRyb2wnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuaGFuZGxlQ2FtZXJhQ29udHJvbChhcmdzKTtcclxuICAgICAgICAgICAgY2FzZSAnc2NlbmVfdmlld19zdGF0dXNfbWFuYWdlbWVudCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5oYW5kbGVTdGF0dXNNYW5hZ2VtZW50KGFyZ3MpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHRvb2w6ICR7dG9vbE5hbWV9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlR2l6bW9NYW5hZ2VtZW50KGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24sIHRvb2xOYW1lLCBwaXZvdE5hbWUsIGNvb3JkaW5hdGVUeXBlIH0gPSBhcmdzO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdjaGFuZ2VfdG9vbCc6XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRvb2xOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndG9vbE5hbWUgaXMgcmVxdWlyZWQgZm9yIGNoYW5nZV90b29sIGFjdGlvbicgfTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNoYW5nZUdpem1vVG9vbCh0b29sTmFtZSk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3F1ZXJ5X3Rvb2wnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlHaXptb1Rvb2xOYW1lKCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2NoYW5nZV9waXZvdCc6XHJcbiAgICAgICAgICAgICAgICBpZiAoIXBpdm90TmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3Bpdm90TmFtZSBpcyByZXF1aXJlZCBmb3IgY2hhbmdlX3Bpdm90IGFjdGlvbicgfTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNoYW5nZUdpem1vUGl2b3QocGl2b3ROYW1lKTtcclxuICAgICAgICAgICAgY2FzZSAncXVlcnlfcGl2b3QnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlHaXptb1Bpdm90KCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2NoYW5nZV9jb29yZGluYXRlJzpcclxuICAgICAgICAgICAgICAgIGlmICghY29vcmRpbmF0ZVR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdjb29yZGluYXRlVHlwZSBpcyByZXF1aXJlZCBmb3IgY2hhbmdlX2Nvb3JkaW5hdGUgYWN0aW9uJyB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY2hhbmdlR2l6bW9Db29yZGluYXRlKGNvb3JkaW5hdGVUeXBlKTtcclxuICAgICAgICAgICAgY2FzZSAncXVlcnlfY29vcmRpbmF0ZSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5xdWVyeUdpem1vQ29vcmRpbmF0ZSgpO1xyXG4gICAgICAgICAgICBjYXNlICdxdWVyeV92aWV3X21vZGUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlHaXptb1ZpZXdNb2RlKCk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVZpZXdNb2RlQ29udHJvbChhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHsgYWN0aW9uLCBpczJELCBncmlkVmlzaWJsZSB9ID0gYXJncztcclxuXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnY2hhbmdlXzJkXzNkJzpcclxuICAgICAgICAgICAgICAgIGlmIChpczJEID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdpczJEIGlzIHJlcXVpcmVkIGZvciBjaGFuZ2VfMmRfM2QgYWN0aW9uJyB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY2hhbmdlVmlld01vZGUyRDNEKGlzMkQpO1xyXG4gICAgICAgICAgICBjYXNlICdxdWVyeV8yZF8zZCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5xdWVyeVZpZXdNb2RlMkQzRCgpO1xyXG4gICAgICAgICAgICBjYXNlICdzZXRfZ3JpZCc6XHJcbiAgICAgICAgICAgICAgICBpZiAoZ3JpZFZpc2libGUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ2dyaWRWaXNpYmxlIGlzIHJlcXVpcmVkIGZvciBzZXRfZ3JpZCBhY3Rpb24nIH07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zZXRHcmlkVmlzaWJsZShncmlkVmlzaWJsZSk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3F1ZXJ5X2dyaWQnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlHcmlkVmlzaWJsZSgpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBhY3Rpb246ICR7YWN0aW9ufWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVJY29uR2l6bW8oYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiwgaXMzRCwgc2l6ZSB9ID0gYXJncztcclxuXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnc2V0XzNkX21vZGUnOlxyXG4gICAgICAgICAgICAgICAgaWYgKGlzM0QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ2lzM0QgaXMgcmVxdWlyZWQgZm9yIHNldF8zZF9tb2RlIGFjdGlvbicgfTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNldEljb25HaXptbzNEKGlzM0QpO1xyXG4gICAgICAgICAgICBjYXNlICdxdWVyeV8zZF9tb2RlJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnF1ZXJ5SWNvbkdpem1vM0QoKTtcclxuICAgICAgICAgICAgY2FzZSAnc2V0X3NpemUnOlxyXG4gICAgICAgICAgICAgICAgaWYgKHNpemUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3NpemUgaXMgcmVxdWlyZWQgZm9yIHNldF9zaXplIGFjdGlvbicgfTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNldEljb25HaXptb1NpemUoc2l6ZSk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3F1ZXJ5X3NpemUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlJY29uR2l6bW9TaXplKCk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUNhbWVyYUNvbnRyb2woYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiwgbm9kZVV1aWRzIH0gPSBhcmdzO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdmb2N1c19vbl9ub2Rlcyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5mb2N1c0NhbWVyYU9uTm9kZXMobm9kZVV1aWRzIHx8IFtdKTtcclxuICAgICAgICAgICAgY2FzZSAnYWxpZ25fY2FtZXJhX3dpdGhfdmlldyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5hbGlnbkNhbWVyYVdpdGhWaWV3KCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2FsaWduX3ZpZXdfd2l0aF9ub2RlJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmFsaWduVmlld1dpdGhOb2RlKCk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVN0YXR1c01hbmFnZW1lbnQoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiB9ID0gYXJncztcclxuXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnZ2V0X3N0YXR1cyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXRTY2VuZVZpZXdTdGF0dXMoKTtcclxuICAgICAgICAgICAgY2FzZSAncmVzZXRfdmlldyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5yZXNldFNjZW5lVmlldygpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBhY3Rpb246ICR7YWN0aW9ufWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUHJpdmF0ZSBpbXBsZW1lbnRhdGlvbiBtZXRob2RzXHJcbiAgICBwcml2YXRlIGFzeW5jIGNoYW5nZUdpem1vVG9vbChuYW1lOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NoYW5nZS1naXptby10b29sJywgbmFtZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEdpem1vIHRvb2wgY2hhbmdlZCB0byAnJHtuYW1lfSdgLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogeyB0b29sTmFtZTogbmFtZSB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5R2l6bW9Ub29sTmFtZSgpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRvb2xOYW1lOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1naXptby10b29sLW5hbWUnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFRvb2w6IHRvb2xOYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBDdXJyZW50IEdpem1vIHRvb2w6ICR7dG9vbE5hbWV9YFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjaGFuZ2VHaXptb1Bpdm90KG5hbWU6IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY2hhbmdlLWdpem1vLXBpdm90JywgbmFtZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEdpem1vIHBpdm90IGNoYW5nZWQgdG8gJyR7bmFtZX0nYCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHsgcGl2b3ROYW1lOiBuYW1lIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlHaXptb1Bpdm90KCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGl2b3ROYW1lOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1naXptby1waXZvdCcpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50UGl2b3Q6IHBpdm90TmFtZSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ3VycmVudCBHaXptbyBwaXZvdDogJHtwaXZvdE5hbWV9YFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUdpem1vVmlld01vZGUoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCB2aWV3TW9kZTogc3RyaW5nID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZ2l6bW8tdmlldy1tb2RlJyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIHZpZXdNb2RlOiB2aWV3TW9kZSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ3VycmVudCB2aWV3IG1vZGU6ICR7dmlld01vZGV9YFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjaGFuZ2VHaXptb0Nvb3JkaW5hdGUodHlwZTogc3RyaW5nKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjaGFuZ2UtZ2l6bW8tY29vcmRpbmF0ZScsIHR5cGUpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBDb29yZGluYXRlIHN5c3RlbSBjaGFuZ2VkIHRvICcke3R5cGV9J2AsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7IGNvb3JkaW5hdGVUeXBlOiB0eXBlIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlHaXptb0Nvb3JkaW5hdGUoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBjb29yZGluYXRlOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1naXptby1jb29yZGluYXRlJyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvb3JkaW5hdGU6IGNvb3JkaW5hdGUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEN1cnJlbnQgY29vcmRpbmF0ZSBzeXN0ZW06ICR7Y29vcmRpbmF0ZX1gXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNoYW5nZVZpZXdNb2RlMkQzRChpczJEOiBib29sZWFuKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjaGFuZ2UtaXMyRCcsIGlzMkQpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBWaWV3IG1vZGUgY2hhbmdlZCB0byAke2lzMkQgPyAnMkQnIDogJzNEJ31gLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogeyBpczJEOiBpczJELCB2aWV3TW9kZTogaXMyRCA/ICcyRCcgOiAnM0QnIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlWaWV3TW9kZTJEM0QoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBpczJEOiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaXMyRCcpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBpczJEOiBpczJELFxyXG4gICAgICAgICAgICAgICAgICAgIHZpZXdNb2RlOiBpczJEID8gJzJEJyA6ICczRCcsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEN1cnJlbnQgdmlldyBtb2RlOiAke2lzMkQgPyAnMkQnIDogJzNEJ31gXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldEdyaWRWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1ncmlkLXZpc2libGUnLCB2aXNpYmxlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgR3JpZCAke3Zpc2libGUgPyAnc2hvd24nIDogJ2hpZGRlbid9YCxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHsgZ3JpZFZpc2libGU6IHZpc2libGUgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUdyaWRWaXNpYmxlKCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdmlzaWJsZTogYm9vbGVhbiA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWlzLWdyaWQtdmlzaWJsZScpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB2aXNpYmxlLFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBHcmlkIGlzICR7dmlzaWJsZSA/ICd2aXNpYmxlJyA6ICdoaWRkZW4nfWBcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0SWNvbkdpem1vM0QoaXMzRDogYm9vbGVhbik6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LWljb24tZ2l6bW8tM2QnLCBpczNEKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSWNvbkdpem1vIHNldCB0byAke2lzM0QgPyAnM0QnIDogJzJEJ30gbW9kZWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7IGlzM0Q6IGlzM0QsIG1vZGU6IGlzM0QgPyAnM0QnIDogJzJEJyB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5SWNvbkdpem1vM0QoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBpczNEOiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaXMtaWNvbi1naXptby0zZCcpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBpczNEOiBpczNELFxyXG4gICAgICAgICAgICAgICAgICAgIG1vZGU6IGlzM0QgPyAnM0QnIDogJzJEJyxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSWNvbkdpem1vIGlzIGluICR7aXMzRCA/ICczRCcgOiAnMkQnfSBtb2RlYFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRJY29uR2l6bW9TaXplKHNpemU6IG51bWJlcik6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LWljb24tZ2l6bW8tc2l6ZScsIHNpemUpO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBJY29uR2l6bW8gc2l6ZSBzZXQgdG8gJHtzaXplfWAsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7IHNpemU6IHNpemUgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUljb25HaXptb1NpemUoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBzaXplOiBudW1iZXIgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1pY29uLWdpem1vLXNpemUnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2l6ZTogc2l6ZSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSWNvbkdpem1vIHNpemU6ICR7c2l6ZX1gXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGZvY3VzQ2FtZXJhT25Ob2Rlcyhub2RlVXVpZHM6IHN0cmluZ1tdKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdmb2N1cy1jYW1lcmEnLCBub2RlVXVpZHMpO1xyXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gbm9kZVV1aWRzLmxlbmd0aCA9PT0gMCA/XHJcbiAgICAgICAgICAgICAgICAnQ2FtZXJhIGZvY3VzZWQgb24gYWxsIG5vZGVzJyA6XHJcbiAgICAgICAgICAgICAgICBgQ2FtZXJhIGZvY3VzZWQgb24gJHtub2RlVXVpZHMubGVuZ3RofSBub2RlKHMpYDtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogeyBmb2N1c2VkTm9kZXM6IG5vZGVVdWlkcyB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGFsaWduQ2FtZXJhV2l0aFZpZXcoKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdhbGlnbi13aXRoLXZpZXcnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnU2NlbmUgY2FtZXJhIGFsaWduZWQgd2l0aCBjdXJyZW50IHZpZXcnXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGFsaWduVmlld1dpdGhOb2RlKCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnYWxpZ24tdmlldy13aXRoLW5vZGUnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnVmlldyBhbGlnbmVkIHdpdGggc2VsZWN0ZWQgbm9kZSBzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFNjZW5lVmlld1N0YXR1cygpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIEdhdGhlciBhbGwgdmlldyBzdGF0dXMgaW5mb3JtYXRpb25cclxuICAgICAgICAgICAgY29uc3QgW1xyXG4gICAgICAgICAgICAgICAgZ2l6bW9Ub29sLFxyXG4gICAgICAgICAgICAgICAgZ2l6bW9QaXZvdCxcclxuICAgICAgICAgICAgICAgIGdpem1vQ29vcmRpbmF0ZSxcclxuICAgICAgICAgICAgICAgIHZpZXdNb2RlMkQzRCxcclxuICAgICAgICAgICAgICAgIGdyaWRWaXNpYmxlLFxyXG4gICAgICAgICAgICAgICAgaWNvbkdpem1vM0QsXHJcbiAgICAgICAgICAgICAgICBpY29uR2l6bW9TaXplXHJcbiAgICAgICAgICAgIF0gPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW1xyXG4gICAgICAgICAgICAgICAgdGhpcy5xdWVyeUdpem1vVG9vbE5hbWUoKSxcclxuICAgICAgICAgICAgICAgIHRoaXMucXVlcnlHaXptb1Bpdm90KCksXHJcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXJ5R2l6bW9Db29yZGluYXRlKCksXHJcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXJ5Vmlld01vZGUyRDNEKCksXHJcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXJ5R3JpZFZpc2libGUoKSxcclxuICAgICAgICAgICAgICAgIHRoaXMucXVlcnlJY29uR2l6bW8zRCgpLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5xdWVyeUljb25HaXptb1NpemUoKVxyXG4gICAgICAgICAgICBdKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHN0YXR1czogYW55ID0ge1xyXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIC8vIEV4dHJhY3QgZGF0YSBmcm9tIGZ1bGZpbGxlZCBwcm9taXNlc1xyXG4gICAgICAgICAgICBpZiAoZ2l6bW9Ub29sLnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgZ2l6bW9Ub29sLnZhbHVlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHN0YXR1cy5naXptb1Rvb2wgPSBnaXptb1Rvb2wudmFsdWUuZGF0YS5jdXJyZW50VG9vbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZ2l6bW9QaXZvdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGdpem1vUGl2b3QudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmdpem1vUGl2b3QgPSBnaXptb1Bpdm90LnZhbHVlLmRhdGEuY3VycmVudFBpdm90O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChnaXptb0Nvb3JkaW5hdGUuc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiBnaXptb0Nvb3JkaW5hdGUudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmNvb3JkaW5hdGUgPSBnaXptb0Nvb3JkaW5hdGUudmFsdWUuZGF0YS5jb29yZGluYXRlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh2aWV3TW9kZTJEM0Quc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiB2aWV3TW9kZTJEM0QudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmlzMkQgPSB2aWV3TW9kZTJEM0QudmFsdWUuZGF0YS5pczJEO1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLnZpZXdNb2RlID0gdmlld01vZGUyRDNELnZhbHVlLmRhdGEudmlld01vZGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGdyaWRWaXNpYmxlLnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgZ3JpZFZpc2libGUudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmdyaWRWaXNpYmxlID0gZ3JpZFZpc2libGUudmFsdWUuZGF0YS52aXNpYmxlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpY29uR2l6bW8zRC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGljb25HaXptbzNELnZhbHVlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHN0YXR1cy5pY29uR2l6bW8zRCA9IGljb25HaXptbzNELnZhbHVlLmRhdGEuaXMzRDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaWNvbkdpem1vU2l6ZS5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGljb25HaXptb1NpemUudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmljb25HaXptb1NpemUgPSBpY29uR2l6bW9TaXplLnZhbHVlLmRhdGEuc2l6ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBzdGF0dXMsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnU2NlbmUgdmlldyBzdGF0dXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseSdcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gZ2V0IHNjZW5lIHZpZXcgc3RhdHVzOiAke2Vyci5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyByZXNldFNjZW5lVmlldygpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIFJlc2V0IHNjZW5lIHZpZXcgdG8gZGVmYXVsdCBzZXR0aW5nc1xyXG4gICAgICAgICAgICBjb25zdCByZXNldEFjdGlvbnMgPSBbXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoYW5nZUdpem1vVG9vbCgncG9zaXRpb24nKSxcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlR2l6bW9QaXZvdCgncGl2b3QnKSxcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlR2l6bW9Db29yZGluYXRlKCdsb2NhbCcpLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGFuZ2VWaWV3TW9kZTJEM0QoZmFsc2UpLCAvLyAzRCBtb2RlXHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldEdyaWRWaXNpYmxlKHRydWUpLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJY29uR2l6bW8zRCh0cnVlKSxcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWNvbkdpem1vU2l6ZSg2MClcclxuICAgICAgICAgICAgXTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHJlc2V0QWN0aW9ucyk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdTY2VuZSB2aWV3IHJlc2V0IHRvIGRlZmF1bHQgc2V0dGluZ3MnLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHRTZXR0aW5nczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBnaXptb1Rvb2w6ICdwb3NpdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdpem1vUGl2b3Q6ICdwaXZvdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvb3JkaW5hdGU6ICdsb2NhbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdNb2RlOiAnM0QnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBncmlkVmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWNvbkdpem1vM0Q6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGljb25HaXptb1NpemU6IDYwXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byByZXNldCBzY2VuZSB2aWV3OiAke2Vyci5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0iXX0=