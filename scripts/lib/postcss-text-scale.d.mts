// [m3] Types for the D-55 text-scale PostCSS plugin (vite.config.ts is type-checked).
export declare const SCALE: string;
export declare function scaleFontSize(value: string): string;
export declare function scaleFontShorthand(value: string): string;
export declare function shouldScaleFile(file: string | undefined): boolean;
export declare function textScalePlugin(): { postcssPlugin: string; Declaration(decl: unknown): void };
