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
 * Natural language intent parser for quick prototyping
 */
export declare function createSpecFromPrompt(prompt: string, appName?: string): ForgeSpec;
