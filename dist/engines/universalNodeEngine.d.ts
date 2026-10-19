import { ForgeSpec } from "../spec/schema.js";
import { AppGenerationEngine, GenerationResult } from "./types.js";
export declare class UniversalNodeEngine implements AppGenerationEngine {
    name: string;
    canHandle(_spec: ForgeSpec): boolean;
    generate(spec: ForgeSpec, _targetDirectory: string): Promise<GenerationResult>;
    private generateDocumentEditorApp;
    private generateStandardApp;
}
