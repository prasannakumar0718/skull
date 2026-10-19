import { ForgeSpec } from "../spec/schema.js";
import { AppGenerationEngine, GenerationResult } from "./types.js";
export declare class EngineOrchestrator {
    private engines;
    constructor();
    selectEngine(spec: ForgeSpec): AppGenerationEngine;
    generateProject(spec: ForgeSpec, outputDirectory: string): Promise<GenerationResult>;
}
