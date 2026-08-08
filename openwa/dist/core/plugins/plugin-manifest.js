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
exports.INSTALLABLE_TYPES = exports.RESERVED_PLUGIN_IDS = void 0;
exports.validatePluginManifest = validatePluginManifest;
const path = __importStar(require("path"));
const plugin_interfaces_1 = require("./plugin.interfaces");
exports.RESERVED_PLUGIN_IDS = new Set(['whatsapp-web.js', 'baileys', 'auto-reply', 'translation']);
exports.INSTALLABLE_TYPES = new Set([plugin_interfaces_1.PluginType.EXTENSION]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]*$/i;
const REQUIRED_FIELDS = ['id', 'name', 'version', 'type', 'main'];
function validatePluginManifest(manifest) {
    if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
        throw new Error('manifest.json must be a JSON object');
    }
    const m = manifest;
    for (const field of REQUIRED_FIELDS) {
        if (typeof m[field] !== 'string' || m[field].length === 0) {
            throw new Error(`manifest.json is missing or has an invalid required field: ${field}`);
        }
    }
    if (!SAFE_ID.test(m.id) || m.id.includes('..')) {
        throw new Error(`Invalid plugin id: "${m.id}"`);
    }
    if (exports.RESERVED_PLUGIN_IDS.has(m.id.toLowerCase())) {
        throw new Error(`Plugin id "${m.id}" is reserved by a built-in plugin`);
    }
    if (!exports.INSTALLABLE_TYPES.has(m.type)) {
        throw new Error(`Plugin type "${m.type}" is not installable — only extension plugins can be installed (engines and other tiers are built-in).`);
    }
    assertMainContained(m.main);
}
function assertMainContained(main) {
    const normalized = path.posix.normalize(main);
    if (path.posix.isAbsolute(main) || normalized === '..' || normalized.startsWith('../') || main.includes('\\')) {
        throw new Error(`manifest.json main escapes the plugin directory: "${main}"`);
    }
}
//# sourceMappingURL=plugin-manifest.js.map