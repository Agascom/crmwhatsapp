import { PluginManifest } from './plugin.interfaces';
export declare const RESERVED_PLUGIN_IDS: Set<string>;
export declare const INSTALLABLE_TYPES: Set<string>;
export declare function validatePluginManifest(manifest: unknown): asserts manifest is PluginManifest;
