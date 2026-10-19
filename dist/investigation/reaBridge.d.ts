export interface InvestigationEvidence {
    sourcePath: string;
    kind: "schema" | "routes" | "operations" | "binary-structure" | "bundle";
    findings: Record<string, unknown>;
    confidence: number;
}
export interface InvestigationResult {
    isAvailable: boolean;
    provider: "rea-native" | "rea-mcp" | "forge-heuristic";
    evidence: InvestigationEvidence[];
    suggestedEntities: string[];
    suggestedOperations: string[];
}
/**
 * Bridges Agent App Forge to REA investigation capabilities.
 * If REA binaries/MCP tools are present, it leverages REA's deep binary/source analyzers.
 * If REA is not installed, it gracefully falls back to lightweight AST/heuristic extraction.
 */
export declare class ReaInvestigationBridge {
    private reaRootPath?;
    constructor(reaPath?: string);
    investigate(targetPath: string): Promise<InvestigationResult>;
    private findFiles;
}
