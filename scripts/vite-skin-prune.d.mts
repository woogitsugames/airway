// Types of scripts/vite-skin-prune.mjs (tsc has no Node types here).
export declare const SKIN_STRUCTURE_FILES: string[];
export declare const SKIN_STRUCTURE_FILE: string;
export declare const SKIN_SCOPE: string;
export declare function skinOverrides(structureCss: string): Map<string, Set<string>> & { hidden?: Set<string> };
export declare function pruneOverridden(css: string, over: Map<string, Set<string>>): { css: string; removed: number };
