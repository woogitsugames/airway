// Types of scripts/vite-skin-inline.mjs for vite.config.ts (tsc has no Node types here).
export declare const SKIN_FILE: string;
export declare const COMPARISON_SKIN_FILE: string;
export declare function skinTokens(skinCss: string): Map<string, string>;
export declare function resolveTokens(tokens: Map<string, string>): Map<string, string>;
export declare function referencedProperties(resolved: Map<string, string>): Set<string>;
export declare function constantProperties(cssSources: string[], scriptSources: string[]): Map<string, string>;
export declare function withConstants(resolved: Map<string, string>, constants: Map<string, string>): Map<string, string>;
export declare const REFERENCED_TOKENS: string[];
export declare function referencedValues(tokens: Map<string, string>, refs: Iterable<string>, constants?: Map<string, string>): Map<string, string>;
export declare function skinBuild(root: string): { resolved: Map<string, string>; inline: Map<string, string>; keep: Set<string>; refs: Set<string> };
export declare function inlineSkin(css: string, resolved: Map<string, string>, file?: string): string;
export declare function keptSkin(resolved: Map<string, string>, keep: Iterable<string>): string;
export declare function tokensInScript(ts: string): string[];
export declare function skinInline(): import('vite').Plugin;
