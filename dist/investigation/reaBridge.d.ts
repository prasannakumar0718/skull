export type InvestigationProvider = "forge-source-parser" | "rea-cli" | "rea-mcp" | "test-fixture";
export interface InvestigationEvidence {
    sourcePath: string;
    kind: "schema" | "routes" | "operations" | "binary-structure" | "bundle";
    findings: Record<string, unknown>;
    confidence: number;
}
export interface ReaStatus {
    cliFound: boolean;
    mcpFound: boolean;
    details: string;
}
export interface InvestigationResult {
    isAvailable: boolean;
    reaAvailable: boolean;
    provider: InvestigationProvider;
    evidence: InvestigationEvidence[];
    suggestedEntities: string[];
    suggestedOperations: string[];
    reaStatus: ReaStatus;
    warnings?: string[];
}
/**
 * Bridges Agent App Forge to REA (Reverse Engineer Anything) capabilities.
 *
 * DESIGN PRINCIPLE: Strict Truthfulness
 * - If real REA CLI / MCP is installed and functioning, it executes REA tools.
 * - If REA is unbuilt, uninstalled, or unavailable, it degrades gracefully to
 *   Agent App Forge's native source parser and reports provider as 'forge-source-parser'.
 * - It never claims REA was executed when only native Forge heuristic parsing was performed.
 */
export declare class ReaInvestigationBridge {
    private reaRootPath?;
    private customProvider?;
    constructor(reaPath?: string);
    /**
     * Probes whether REA is genuinely installed and runnable in the host environment.
     */
    probeReaStatus(): ReaStatus;
    /**
     * Investigates a target reference project or file.
     */
    investigate(targetPath: string): Promise<InvestigationResult>;
    /**
     * Native Forge source code parser.
     * Parses Prisma schemas, SQL DDL, and TypeScript/JavaScript route files.
     */
    private executeNativeForgeParser;
    /**
     * Invokes real REA CLI when present.
     */
    private executeReaCli;
    /**
     * Evaluates recorded REA test fixtures for deterministic testing.
     */
    private executeFixtureAnalysis;
    setProviderForTesting(provider?: InvestigationProvider): void;
    private findFiles;
}
