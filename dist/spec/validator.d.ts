import { ForgeSpec } from "./schema.js";
export interface SpecValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function validateForgeSpec(data: unknown): {
    spec?: ForgeSpec;
    result: SpecValidationResult;
};
/**
 * Natural language intent parser for application synthesis.
 * Supports diverse application domains: Task/Todo, Fee/Financial, E-Commerce, Blog/Publishing, and Generic.
 * Injects explicit domain and inferred assumptions metadata.
 */
export declare function createSpecFromPrompt(prompt: string, appName?: string): ForgeSpec;
