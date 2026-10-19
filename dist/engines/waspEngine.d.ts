import { ForgeSpec } from "../spec/schema.js";
import { AppGenerationEngine, GenerationResult } from "./types.js";
export declare class WaspEngine implements AppGenerationEngine {
    name: string;
    canHandle(spec: ForgeSpec): boolean;
    generate(spec: ForgeSpec, _targetDirectory: string): Promise<GenerationResult>;
}
