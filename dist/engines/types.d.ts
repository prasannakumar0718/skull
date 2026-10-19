import { ForgeSpec } from "../spec/schema.js";
export interface GeneratedFile {
    relativePath: string;
    content: string;
}
export interface GenerationResult {
    engineName: string;
    files: GeneratedFile[];
    entryPointInstructions: string;
    supportedOnPlatform: boolean;
    platformNotes?: string;
}
export interface AppGenerationEngine {
    name: string;
    canHandle(spec: ForgeSpec): boolean;
    generate(spec: ForgeSpec, targetDirectory: string): Promise<GenerationResult>;
}
