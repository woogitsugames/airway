// Types of scripts/vite-skin-prune.mjs (tsc has no Node types here).
export declare const KARTA_FILE: string;
export declare const KARTA_SCOPE: string;
export declare function kartaOverrides(kartaCss: string): Map<string, Set<string>>;
export declare function pruneOverridden(css: string, over: Map<string, Set<string>>): { css: string; removed: number };
