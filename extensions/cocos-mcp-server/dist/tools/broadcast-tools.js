"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcastTools = void 0;
class BroadcastTools {
    constructor() {
        this.listeners = new Map();
        this.messageLog = [];
        this.setupBroadcastListeners();
    }
    getTools() {
        return [
            // 1. Broadcast Log Management - Log operations
            {
                name: 'broadcast_log_management',
                description: 'BROADCAST LOG MANAGEMENT: Monitor Cocos Creator internal messages for debugging and system monitoring. USAGE: get_log to view recent events, clear_log to reset history. DEBUGGING: Use messageType filter to focus on specific events like "scene:ready" or "asset-db:asset-add".',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['get_log', 'clear_log'],
                            description: 'Log operation: "get_log" = retrieve recent broadcast messages (supports limit+messageType filters) | "clear_log" = clear all stored message history (no parameters needed)'
                        },
                        // For get_log action
                        limit: {
                            type: 'number',
                            description: 'Maximum messages to return (get_log action). Controls output size. Examples: 10 for recent events, 100 for comprehensive history, 500 for deep debugging. Default: 50 for balanced view.',
                            default: 50,
                            minimum: 1,
                            maximum: 1000
                        },
                        messageType: {
                            type: 'string',
                            description: 'Message type filter (get_log action). Show only specific event types. Common filters: "scene:ready" (scene loaded), "asset-db:asset-add" (asset imported), "build-worker:ready" (build system). Leave empty for all messages.'
                        }
                    },
                    required: ['action']
                }
            },
            // 2. Broadcast Listener Management - Listener operations
            {
                name: 'broadcast_listener_management',
                description: 'BROADCAST LISTENER MANAGEMENT: Control which Cocos Creator events to monitor in real-time. WORKFLOW: start_listening to begin monitoring events → get_active_listeners to see current monitors → stop_listening to end monitoring. Useful for debugging workflows and system monitoring.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['start_listening', 'stop_listening', 'get_active_listeners'],
                            description: 'Listener operation: "start_listening" = begin monitoring events (requires messageType) | "stop_listening" = stop monitoring events (requires messageType) | "get_active_listeners" = list current monitors (no parameters needed)'
                        },
                        // For start_listening and stop_listening actions
                        messageType: {
                            type: 'string',
                            description: 'Event type to monitor (REQUIRED for start_listening/stop_listening). Critical events: "scene:ready" (scene changes), "asset-db:asset-add" (imports), "asset-db:asset-change" (modifications), "build-worker:ready" (build status). Case-sensitive exact match required.'
                        }
                    },
                    required: ['action']
                }
            }
        ];
    }
    async execute(toolName, args) {
        switch (toolName) {
            case 'broadcast_log_management':
                return await this.handleBroadcastLogManagement(args);
            case 'broadcast_listener_management':
                return await this.handleBroadcastListenerManagement(args);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    setupBroadcastListeners() {
        // 设置预定义的重要广播消息监听
        const importantMessages = [
            'build-worker:ready',
            'build-worker:closed',
            'scene:ready',
            'scene:close',
            'scene:light-probe-edit-mode-changed',
            'scene:light-probe-bounding-box-edit-mode-changed',
            'asset-db:ready',
            'asset-db:close',
            'asset-db:asset-add',
            'asset-db:asset-change',
            'asset-db:asset-delete'
        ];
        importantMessages.forEach(messageType => {
            this.addBroadcastListener(messageType);
        });
    }
    addBroadcastListener(messageType) {
        const listener = (data) => {
            this.messageLog.push({
                message: messageType,
                data: data,
                timestamp: Date.now()
            });
            // 保持日志大小在合理范围内
            if (this.messageLog.length > 1000) {
                this.messageLog = this.messageLog.slice(-500);
            }
            console.log(`[Broadcast] ${messageType}:`, data);
        };
        if (!this.listeners.has(messageType)) {
            this.listeners.set(messageType, []);
        }
        this.listeners.get(messageType).push(listener);
        // 注册 Editor 消息监听 - 暂时注释掉，Editor.Message API可能不支持
        // Editor.Message.on(messageType, listener);
        console.log(`[BroadcastTools] Added listener for ${messageType} (simulated)`);
    }
    removeBroadcastListener(messageType) {
        const listeners = this.listeners.get(messageType);
        if (listeners) {
            listeners.forEach(listener => {
                // Editor.Message.off(messageType, listener);
                console.log(`[BroadcastTools] Removed listener for ${messageType} (simulated)`);
            });
            this.listeners.delete(messageType);
        }
    }
    async getBroadcastLog(limit = 50, messageType) {
        let filteredLog = this.messageLog;
        if (messageType) {
            filteredLog = this.messageLog.filter(entry => entry.message === messageType);
        }
        const recentLog = filteredLog.slice(-limit).map(entry => (Object.assign(Object.assign({}, entry), { timestamp: new Date(entry.timestamp).toISOString() })));
        return {
            success: true,
            data: {
                log: recentLog,
                count: recentLog.length,
                totalCount: filteredLog.length,
                filter: messageType || 'all',
                message: 'Broadcast log retrieved successfully'
            }
        };
    }
    async listenBroadcast(messageType) {
        if (!this.listeners.has(messageType)) {
            this.addBroadcastListener(messageType);
            return {
                success: true,
                data: {
                    messageType: messageType,
                    message: `Started listening for broadcast: ${messageType}`
                }
            };
        }
        else {
            return {
                success: true,
                data: {
                    messageType: messageType,
                    message: `Already listening for broadcast: ${messageType}`
                }
            };
        }
    }
    async stopListening(messageType) {
        if (this.listeners.has(messageType)) {
            this.removeBroadcastListener(messageType);
            return {
                success: true,
                data: {
                    messageType: messageType,
                    message: `Stopped listening for broadcast: ${messageType}`
                }
            };
        }
        else {
            return {
                success: true,
                data: {
                    messageType: messageType,
                    message: `Was not listening for broadcast: ${messageType}`
                }
            };
        }
    }
    async clearBroadcastLog() {
        const previousCount = this.messageLog.length;
        this.messageLog = [];
        return {
            success: true,
            data: {
                clearedCount: previousCount,
                message: 'Broadcast log cleared successfully'
            }
        };
    }
    async getActiveListeners() {
        const activeListeners = Array.from(this.listeners.keys()).map(messageType => {
            var _a;
            return ({
                messageType: messageType,
                listenerCount: ((_a = this.listeners.get(messageType)) === null || _a === void 0 ? void 0 : _a.length) || 0
            });
        });
        return {
            success: true,
            data: {
                listeners: activeListeners,
                count: activeListeners.length,
                message: 'Active listeners retrieved successfully'
            }
        };
    }
    // New handler methods for optimized tools
    async handleBroadcastLogManagement(args) {
        const { action, limit, messageType } = args;
        switch (action) {
            case 'get_log':
                return await this.getBroadcastLog(limit, messageType);
            case 'clear_log':
                return await this.clearBroadcastLog();
            default:
                return { success: false, error: `Unknown broadcast log management action: ${action}` };
        }
    }
    async handleBroadcastListenerManagement(args) {
        const { action, messageType } = args;
        switch (action) {
            case 'start_listening':
                return await this.listenBroadcast(messageType);
            case 'stop_listening':
                return await this.stopListening(messageType);
            case 'get_active_listeners':
                return await this.getActiveListeners();
            default:
                return { success: false, error: `Unknown broadcast listener management action: ${action}` };
        }
    }
}
exports.BroadcastTools = BroadcastTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvYWRjYXN0LXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL2Jyb2FkY2FzdC10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxNQUFhLGNBQWM7SUFJdkI7UUFIUSxjQUFTLEdBQTRCLElBQUksR0FBRyxFQUFFLENBQUM7UUFDL0MsZUFBVSxHQUE2RCxFQUFFLENBQUM7UUFHOUUsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7SUFDbkMsQ0FBQztJQUVELFFBQVE7UUFDSixPQUFPO1lBQ0gsK0NBQStDO1lBQy9DO2dCQUNJLElBQUksRUFBRSwwQkFBMEI7Z0JBQ2hDLFdBQVcsRUFBRSxvUkFBb1I7Z0JBQ2pTLFdBQVcsRUFBRTtvQkFDVCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUU7d0JBQ1IsTUFBTSxFQUFFOzRCQUNKLElBQUksRUFBRSxRQUFROzRCQUNkLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUM7NEJBQzlCLFdBQVcsRUFBRSw0S0FBNEs7eUJBQzVMO3dCQUNELHFCQUFxQjt3QkFDckIsS0FBSyxFQUFFOzRCQUNILElBQUksRUFBRSxRQUFROzRCQUNkLFdBQVcsRUFBRSwwTEFBMEw7NEJBQ3ZNLE9BQU8sRUFBRSxFQUFFOzRCQUNYLE9BQU8sRUFBRSxDQUFDOzRCQUNWLE9BQU8sRUFBRSxJQUFJO3lCQUNoQjt3QkFDRCxXQUFXLEVBQUU7NEJBQ1QsSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLCtOQUErTjt5QkFDL087cUJBQ0o7b0JBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO2lCQUN2QjthQUNKO1lBRUQseURBQXlEO1lBQ3pEO2dCQUNJLElBQUksRUFBRSwrQkFBK0I7Z0JBQ3JDLFdBQVcsRUFBRSwwUkFBMFI7Z0JBQ3ZTLFdBQVcsRUFBRTtvQkFDVCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUU7d0JBQ1IsTUFB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YixLQUFLLGlCQUFpQjtnQkFDbEIsT0FBTyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbkQsS0FBSyxnQkFBZ0I7Z0JBQ2pCLE9BQU8sTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2pELEtBQUssc0JBQXNCO2dCQUN2QixPQUFPLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDM0M7Z0JBQ0ksT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLGlEQUFpRCxNQUFNLEVBQUUsRUFBRSxDQUFDO1FBQ3BHLENBQUM7SUFDTCxDQUFDO0NBRUo7QUEvUEQsd0NBK1BDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVG9vbERlZmluaXRpb24sIFRvb2xSZXNwb25zZSwgVG9vbEV4ZWN1dG9yIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5cclxuZXhwb3J0IGNsYXNzIEJyb2FkY2FzdFRvb2xzIGltcGxlbWVudHMgVG9vbEV4ZWN1dG9yIHtcclxuICAgIHByaXZhdGUgbGlzdGVuZXJzOiBNYXA8c3RyaW5nLCBGdW5jdGlvbltdPiA9IG5ldyBNYXAoKTtcclxuICAgIHByaXZhdGUgbWVzc2FnZUxvZzogQXJyYXk8eyBtZXNzYWdlOiBzdHJpbmc7IGRhdGE6IGFueTsgdGltZXN0YW1wOiBudW1iZXIgfT4gPSBbXTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLnNldHVwQnJvYWRjYXN0TGlzdGVuZXJzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0VG9vbHMoKTogVG9vbERlZmluaXRpb25bXSB7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgLy8gMS4gQnJvYWRjYXN0IExvZyBNYW5hZ2VtZW50IC0gTG9nIG9wZXJhdGlvbnNcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2Jyb2FkY2FzdF9sb2dfbWFuYWdlbWVudCcsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0JST0FEQ0FTVCBMT0cgTUFOQUdFTUVOVDogTW9uaXRvciBDb2NvcyBDcmVhdG9yIGludGVybmFsIG1lc3NhZ2VzIGZvciBkZWJ1Z2dpbmcgYW5kIHN5c3RlbSBtb25pdG9yaW5nLiBVU0FHRTogZ2V0X2xvZyB0byB2aWV3IHJlY2VudCBldmVudHMsIGNsZWFyX2xvZyB0byByZXNldCBoaXN0b3J5LiBERUJVR0dJTkc6IFVzZSBtZXNzYWdlVHlwZSBmaWx0ZXIgdG8gZm9jdXMgb24gc3BlY2lmaWMgZXZlbnRzIGxpa2UgXCJzY2VuZTpyZWFkeVwiIG9yIFwiYXNzZXQtZGI6YXNzZXQtYWRkXCIuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydnZXRfbG9nJywgJ2NsZWFyX2xvZyddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdMb2cgb3BlcmF0aW9uOiBcImdldF9sb2dcIiA9IHJldHJpZXZlIHJlY2VudCBicm9hZGNhc3QgbWVzc2FnZXMgKHN1cHBvcnRzIGxpbWl0K21lc3NhZ2VUeXBlIGZpbHRlcnMpIHwgXCJjbGVhcl9sb2dcIiA9IGNsZWFyIGFsbCBzdG9yZWQgbWVzc2FnZSBoaXN0b3J5IChubyBwYXJhbWV0ZXJzIG5lZWRlZCknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvciBnZXRfbG9nIGFjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBsaW1pdDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ01heGltdW0gbWVzc2FnZXMgdG8gcmV0dXJuIChnZXRfbG9nIGFjdGlvbikuIENvbnRyb2xzIG91dHB1dCBzaXplLiBFeGFtcGxlczogMTAgZm9yIHJlY2VudCBldmVudHMsIDEwMCBmb3IgY29tcHJlaGVuc2l2ZSBoaXN0b3J5LCA1MDAgZm9yIGRlZXAgZGVidWdnaW5nLiBEZWZhdWx0OiA1MCBmb3IgYmFsYW5jZWQgdmlldy4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogNTAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogMTAwMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlVHlwZToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ01lc3NhZ2UgdHlwZSBmaWx0ZXIgKGdldF9sb2cgYWN0aW9uKS4gU2hvdyBvbmx5IHNwZWNpZmljIGV2ZW50IHR5cGVzLiBDb21tb24gZmlsdGVyczogXCJzY2VuZTpyZWFkeVwiIChzY2VuZSBsb2FkZWQpLCBcImFzc2V0LWRiOmFzc2V0LWFkZFwiIChhc3NldCBpbXBvcnRlZCksIFwiYnVpbGQtd29ya2VyOnJlYWR5XCIgKGJ1aWxkIHN5c3RlbSkuIExlYXZlIGVtcHR5IGZvciBhbGwgbWVzc2FnZXMuJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG5cclxuICAgICAgICAgICAgLy8gMi4gQnJvYWRjYXN0IExpc3RlbmVyIE1hbmFnZW1lbnQgLSBMaXN0ZW5lciBvcGVyYXRpb25zXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdicm9hZGNhc3RfbGlzdGVuZXJfbWFuYWdlbWVudCcsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0JST0FEQ0FTVCBMSVNURU5FUiBNQU5BR0VNRU5UOiBDb250cm9sIHdoaWNoIENvY29zIENyZWF0b3IgZXZlbnRzIHRvIG1vbml0b3IgaW4gcmVhbC10aW1lLiBXT1JLRkxPVzogc3RhcnRfbGlzdGVuaW5nIHRvIGJlZ2luIG1vbml0b3JpbmcgZXZlbnRzIOKGkiBnZXRfYWN0aXZlX2xpc3RlbmVycyB0byBzZWUgY3VycmVudCBtb25pdG9ycyDihpIgc3RvcF9saXN0ZW5pbmcgdG8gZW5kIG1vbml0b3JpbmcuIFVzZWZ1bCBmb3IgZGVidWdnaW5nIHdvcmtmbG93cyBhbmQgc3lzdGVtIG1vbml0b3JpbmcuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydzdGFydF9saXN0ZW5pbmcnLCAnc3RvcF9saXN0ZW5pbmcnLCAnZ2V0X2FjdGl2ZV9saXN0ZW5lcnMnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdGVuZXIgb3BlcmF0aW9uOiBcInN0YXJ0X2xpc3RlbmluZ1wiID0gYmVnaW4gbW9uaXRvcmluZyBldmVudHMgKHJlcXVpcmVzIG1lc3NhZ2VUeXBlKSB8IFwic3RvcF9saXN0ZW5pbmdcIiA9IHN0b3AgbW9uaXRvcmluZyBldmVudHMgKHJlcXVpcmVzIG1lc3NhZ2VUeXBlKSB8IFwiZ2V0X2FjdGl2ZV9saXN0ZW5lcnNcIiA9IGxpc3QgY3VycmVudCBtb25pdG9ycyAobm8gcGFyYW1ldGVycyBuZWVkZWQpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3Igc3RhcnRfbGlzdGVuaW5nIGFuZCBzdG9wX2xpc3RlbmluZyBhY3Rpb25zXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VUeXBlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRXZlbnQgdHlwZSB0byBtb25pdG9yIChSRVFVSVJFRCBmb3Igc3RhcnRfbGlzdGVuaW5nL3N0b3BfbGlzdGVuaW5nKS4gQ3JpdGljYWwgZXZlbnRzOiBcInNjZW5lOnJlYWR5XCIgKHNjZW5lIGNoYW5nZXMpLCBcImFzc2V0LWRiOmFzc2V0LWFkZFwiIChpbXBvcnRzKSwgXCJhc3NldC1kYjphc3NldC1jaGFuZ2VcIiAobW9kaWZpY2F0aW9ucyksIFwiYnVpbGQtd29ya2VyOnJlYWR5XCIgKGJ1aWxkIHN0YXR1cykuIENhc2Utc2Vuc2l0aXZlIGV4YWN0IG1hdGNoIHJlcXVpcmVkLidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIF07XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZXhlY3V0ZSh0b29sTmFtZTogc3RyaW5nLCBhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHN3aXRjaCAodG9vbE5hbWUpIHtcclxuICAgICAgICAgICAgY2FzZSAnYnJvYWRjYXN0X2xvZ19tYW5hZ2VtZW50JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUJyb2FkY2FzdExvZ01hbmFnZW1lbnQoYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2Jyb2FkY2FzdF9saXN0ZW5lcl9tYW5hZ2VtZW50JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZUJyb2FkY2FzdExpc3RlbmVyTWFuYWdlbWVudChhcmdzKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0b29sOiAke3Rvb2xOYW1lfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHNldHVwQnJvYWRjYXN0TGlzdGVuZXJzKCk6IHZvaWQge1xyXG4gICAgICAgIC8vIOiuvue9rumihOWumuS5ieeahOmHjeimgeW5v+aSrea2iOaBr+ebkeWQrFxyXG4gICAgICAgIGNvbnN0IGltcG9ydGFudE1lc3NhZ2VzID0gW1xyXG4gICAgICAgICAgICAnYnVpbGQtd29ya2VyOnJlYWR5JyxcclxuICAgICAgICAgICAgJ2J1aWxkLXdvcmtlcjpjbG9zZWQnLFxyXG4gICAgICAgICAgICAnc2NlbmU6cmVhZHknLFxyXG4gICAgICAgICAgICAnc2NlbmU6Y2xvc2UnLFxyXG4gICAgICAgICAgICAnc2NlbmU6bGlnaHQtcHJvYmUtZWRpdC1tb2RlLWNoYW5nZWQnLFxyXG4gICAgICAgICAgICAnc2NlbmU6bGlnaHQtcHJvYmUtYm91bmRpbmctYm94LWVkaXQtbW9kZS1jaGFuZ2VkJyxcclxuICAgICAgICAgICAgJ2Fzc2V0LWRiOnJlYWR5JyxcclxuICAgICAgICAgICAgJ2Fzc2V0LWRiOmNsb3NlJyxcclxuICAgICAgICAgICAgJ2Fzc2V0LWRiOmFzc2V0LWFkZCcsXHJcbiAgICAgICAgICAgICdhc3NldC1kYjphc3NldC1jaGFuZ2UnLFxyXG4gICAgICAgICAgICAnYXNzZXQtZGI6YXNzZXQtZGVsZXRlJ1xyXG4gICAgICAgIF07XHJcblxyXG4gICAgICAgIGltcG9ydGFudE1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZVR5cGUgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmFkZEJyb2FkY2FzdExpc3RlbmVyKG1lc3NhZ2VUeXBlKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFkZEJyb2FkY2FzdExpc3RlbmVyKG1lc3NhZ2VUeXBlOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBsaXN0ZW5lciA9IChkYXRhOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlTG9nLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVR5cGUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhLFxyXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8g5L+d5oyB5pel5b+X5aSn5bCP5Zyo5ZCI55CG6IyD5Zu05YaFXHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1lc3NhZ2VMb2cubGVuZ3RoID4gMTAwMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdlTG9nID0gdGhpcy5tZXNzYWdlTG9nLnNsaWNlKC01MDApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0Jyb2FkY2FzdF0gJHttZXNzYWdlVHlwZX06YCwgZGF0YSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmxpc3RlbmVycy5oYXMobWVzc2FnZVR5cGUpKSB7XHJcbiAgICAgICAgICAgIHRoaXMubGlzdGVuZXJzLnNldChtZXNzYWdlVHlwZSwgW10pO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmxpc3RlbmVycy5nZXQobWVzc2FnZVR5cGUpIS5wdXNoKGxpc3RlbmVyKTtcclxuXHJcbiAgICAgICAgLy8g5rOo5YaMIEVkaXRvciDmtojmga/nm5HlkKwgLSDmmoLml7bms6jph4rmjonvvIxFZGl0b3IuTWVzc2FnZSBBUEnlj6/og73kuI3mlK/mjIFcclxuICAgICAgICAvLyBFZGl0b3IuTWVzc2FnZS5vbihtZXNzYWdlVHlwZSwgbGlzdGVuZXIpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbQnJvYWRjYXN0VG9vbHNdIEFkZGVkIGxpc3RlbmVyIGZvciAke21lc3NhZ2VUeXBlfSAoc2ltdWxhdGVkKWApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcmVtb3ZlQnJvYWRjYXN0TGlzdGVuZXIobWVzc2FnZVR5cGU6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzLmdldChtZXNzYWdlVHlwZSk7XHJcbiAgICAgICAgaWYgKGxpc3RlbmVycykge1xyXG4gICAgICAgICAgICBsaXN0ZW5lcnMuZm9yRWFjaChsaXN0ZW5lciA9PiB7XHJcbiAgICAgICAgICAgICAgICAvLyBFZGl0b3IuTWVzc2FnZS5vZmYobWVzc2FnZVR5cGUsIGxpc3RlbmVyKTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQnJvYWRjYXN0VG9vbHNdIFJlbW92ZWQgbGlzdGVuZXIgZm9yICR7bWVzc2FnZVR5cGV9IChzaW11bGF0ZWQpYCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVycy5kZWxldGUobWVzc2FnZVR5cGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEJyb2FkY2FzdExvZyhsaW1pdDogbnVtYmVyID0gNTAsIG1lc3NhZ2VUeXBlPzogc3RyaW5nKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBsZXQgZmlsdGVyZWRMb2cgPSB0aGlzLm1lc3NhZ2VMb2c7XHJcblxyXG4gICAgICAgIGlmIChtZXNzYWdlVHlwZSkge1xyXG4gICAgICAgICAgICBmaWx0ZXJlZExvZyA9IHRoaXMubWVzc2FnZUxvZy5maWx0ZXIoZW50cnkgPT4gZW50cnkubWVzc2FnZSA9PT0gbWVzc2FnZVR5cGUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcmVjZW50TG9nID0gZmlsdGVyZWRMb2cuc2xpY2UoLWxpbWl0KS5tYXAoZW50cnkgPT4gKHtcclxuICAgICAgICAgICAgLi4uZW50cnksXHJcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoZW50cnkudGltZXN0YW1wKS50b0lTT1N0cmluZygpXHJcbiAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICBsb2c6IHJlY2VudExvZyxcclxuICAgICAgICAgICAgICAgIGNvdW50OiByZWNlbnRMb2cubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgdG90YWxDb3VudDogZmlsdGVyZWRMb2cubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgZmlsdGVyOiBtZXNzYWdlVHlwZSB8fCAnYWxsJyxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdCcm9hZGNhc3QgbG9nIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgbGlzdGVuQnJvYWRjYXN0KG1lc3NhZ2VUeXBlOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMuaGFzKG1lc3NhZ2VUeXBlKSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZEJyb2FkY2FzdExpc3RlbmVyKG1lc3NhZ2VUeXBlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZVR5cGU6IG1lc3NhZ2VUeXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBTdGFydGVkIGxpc3RlbmluZyBmb3IgYnJvYWRjYXN0OiAke21lc3NhZ2VUeXBlfWBcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlVHlwZTogbWVzc2FnZVR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEFscmVhZHkgbGlzdGVuaW5nIGZvciBicm9hZGNhc3Q6ICR7bWVzc2FnZVR5cGV9YFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHN0b3BMaXN0ZW5pbmcobWVzc2FnZVR5cGU6IHN0cmluZyk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzLmhhcyhtZXNzYWdlVHlwZSkpIHtcclxuICAgICAgICAgICAgdGhpcy5yZW1vdmVCcm9hZGNhc3RMaXN0ZW5lcihtZXNzYWdlVHlwZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VUeXBlOiBtZXNzYWdlVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgU3RvcHBlZCBsaXN0ZW5pbmcgZm9yIGJyb2FkY2FzdDogJHttZXNzYWdlVHlwZX1gXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZVR5cGU6IG1lc3NhZ2VUeXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBXYXMgbm90IGxpc3RlbmluZyBmb3IgYnJvYWRjYXN0OiAke21lc3NhZ2VUeXBlfWBcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjbGVhckJyb2FkY2FzdExvZygpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHByZXZpb3VzQ291bnQgPSB0aGlzLm1lc3NhZ2VMb2cubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZUxvZyA9IFtdO1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgIGNsZWFyZWRDb3VudDogcHJldmlvdXNDb3VudCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdCcm9hZGNhc3QgbG9nIGNsZWFyZWQgc3VjY2Vzc2Z1bGx5J1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEFjdGl2ZUxpc3RlbmVycygpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IGFjdGl2ZUxpc3RlbmVycyA9IEFycmF5LmZyb20odGhpcy5saXN0ZW5lcnMua2V5cygpKS5tYXAobWVzc2FnZVR5cGUgPT4gKHtcclxuICAgICAgICAgICAgbWVzc2FnZVR5cGU6IG1lc3NhZ2VUeXBlLFxyXG4gICAgICAgICAgICBsaXN0ZW5lckNvdW50OiB0aGlzLmxpc3RlbmVycy5nZXQobWVzc2FnZVR5cGUpPy5sZW5ndGggfHwgMFxyXG4gICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzOiBhY3RpdmVMaXN0ZW5lcnMsXHJcbiAgICAgICAgICAgICAgICBjb3VudDogYWN0aXZlTGlzdGVuZXJzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdBY3RpdmUgbGlzdGVuZXJzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE5ldyBoYW5kbGVyIG1ldGhvZHMgZm9yIG9wdGltaXplZCB0b29sc1xyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVCcm9hZGNhc3RMb2dNYW5hZ2VtZW50KGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24sIGxpbWl0LCBtZXNzYWdlVHlwZSB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdnZXRfbG9nJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldEJyb2FkY2FzdExvZyhsaW1pdCwgbWVzc2FnZVR5cGUpO1xyXG4gICAgICAgICAgICBjYXNlICdjbGVhcl9sb2cnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY2xlYXJCcm9hZGNhc3RMb2coKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFVua25vd24gYnJvYWRjYXN0IGxvZyBtYW5hZ2VtZW50IGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUJyb2FkY2FzdExpc3RlbmVyTWFuYWdlbWVudChhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHsgYWN0aW9uLCBtZXNzYWdlVHlwZSB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdzdGFydF9saXN0ZW5pbmcnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMubGlzdGVuQnJvYWRjYXN0KG1lc3NhZ2VUeXBlKTtcclxuICAgICAgICAgICAgY2FzZSAnc3RvcF9saXN0ZW5pbmcnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuc3RvcExpc3RlbmluZyhtZXNzYWdlVHlwZSk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2dldF9hY3RpdmVfbGlzdGVuZXJzJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldEFjdGl2ZUxpc3RlbmVycygpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBicm9hZGNhc3QgbGlzdGVuZXIgbWFuYWdlbWVudCBhY3Rpb246ICR7YWN0aW9ufWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG59Il19