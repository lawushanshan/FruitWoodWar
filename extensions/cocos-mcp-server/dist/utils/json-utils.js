"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixCommonJsonIssues = fixCommonJsonIssues;
/**
 * Fix common JSON string issues before parsing.
 * Handles unescaped characters, trailing commas, single quotes, and control characters.
 */
function fixCommonJsonIssues(jsonStr) {
    let fixed = jsonStr;
    fixed = fixed
        // Fix unescaped backslashes
        .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2')
        // Fix trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix single quotes to double quotes
        .replace(/'/g, '"')
        // Fix control characters
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    return fixed;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi11dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS91dGlscy9qc29uLXV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBSUEsa0RBZ0JDO0FBcEJEOzs7R0FHRztBQUNILFNBQWdCLG1CQUFtQixDQUFDLE9BQWU7SUFDL0MsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDO0lBRXBCLEtBQUssR0FBRyxLQUFLO1FBQ1QsNEJBQTRCO1NBQzNCLE9BQU8sQ0FBQyw0QkFBNEIsRUFBRSxVQUFVLENBQUM7UUFDbEQsc0JBQXNCO1NBQ3JCLE9BQU8sQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDO1FBQzlCLHFDQUFxQztTQUNwQyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztRQUNuQix5QkFBeUI7U0FDeEIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7U0FDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7U0FDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztJQUUzQixPQUFPLEtBQUssQ0FBQztBQUNqQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEZpeCBjb21tb24gSlNPTiBzdHJpbmcgaXNzdWVzIGJlZm9yZSBwYXJzaW5nLlxyXG4gKiBIYW5kbGVzIHVuZXNjYXBlZCBjaGFyYWN0ZXJzLCB0cmFpbGluZyBjb21tYXMsIHNpbmdsZSBxdW90ZXMsIGFuZCBjb250cm9sIGNoYXJhY3RlcnMuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZml4Q29tbW9uSnNvbklzc3Vlcyhqc29uU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgbGV0IGZpeGVkID0ganNvblN0cjtcclxuXHJcbiAgICBmaXhlZCA9IGZpeGVkXHJcbiAgICAgICAgLy8gRml4IHVuZXNjYXBlZCBiYWNrc2xhc2hlc1xyXG4gICAgICAgIC5yZXBsYWNlKC8oW15cXFxcXSlcXFxcKFteXCJcXFxcXFwvYmZucnR1XSkvZywgJyQxXFxcXFxcXFwkMicpXHJcbiAgICAgICAgLy8gRml4IHRyYWlsaW5nIGNvbW1hc1xyXG4gICAgICAgIC5yZXBsYWNlKC8sKFxccypbfVxcXV0pL2csICckMScpXHJcbiAgICAgICAgLy8gRml4IHNpbmdsZSBxdW90ZXMgdG8gZG91YmxlIHF1b3Rlc1xyXG4gICAgICAgIC5yZXBsYWNlKC8nL2csICdcIicpXHJcbiAgICAgICAgLy8gRml4IGNvbnRyb2wgY2hhcmFjdGVyc1xyXG4gICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcclxuICAgICAgICAucmVwbGFjZSgvXFxyL2csICdcXFxccicpXHJcbiAgICAgICAgLnJlcGxhY2UoL1xcdC9nLCAnXFxcXHQnKTtcclxuXHJcbiAgICByZXR1cm4gZml4ZWQ7XHJcbn1cclxuIl19