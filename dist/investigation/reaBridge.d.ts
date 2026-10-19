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
export interface ParityReport {
    isMatch: boolean;
    liveVersion: string;
    catalogVersion: string;
    versionMismatch: boolean;
    liveToolCount: number;
    catalogToolCount: number;
    missingInCatalog: string[];
    missingInLive: string[];
    schemaMismatches: Array<{
        tool: string;
        reason: string;
    }>;
    verifiedAt: string;
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
    private liveDiscoveredTools?;
    setProviderForTesting(provider?: InvestigationProvider): void;
    /**
     * Loads the static catalog tools from reaCatalog.json.
     */
    loadCatalogToolsFromFile(): Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }>;
    /**
     * Returns list of upstream REA tools supported by the REA contract (all 207 upstream tools).
     * Prefers runtime-discovered live tools when available.
     */
    listSupportedReaTools(): Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }>;
    /**
     * Retrieves catalog metadata including declared version and upstream source package.
     */
    getCatalogMetadata(): {
        catalogVersion: string;
        sourcePackage: string;
        toolCount: number;
    };
    /**
     * Identifies the exact REA version launched by Forge.
     */
    getReaVersion(): string;
    /**
     * Discovers tools dynamically from the live REA MCP runtime over stdio.
     */
    discoverLiveReaTools(): Promise<Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }>>;
    /**
     * Performs an evidence-based schema and version parity audit against live REA.
     */
    validateParityWithLiveRea(): Promise<ParityReport>;
    /**
     * Executes a native REA command with full argument pass-through.
     */
    executeReaCliCommand(args: string[]): {
        success: boolean;
        exitCode: number;
        stdout: string;
        stderr: string;
        notes?: string;
    };
    /**
     * Delegates invocation of a native REA MCP tool using the real upstream MCP interface.
     * Supports cancellation via optional AbortSignal.
     */
    callReaNativeTool(toolName: string, toolArgs: Record<string, unknown>, abortSignal?: AbortSignal): Promise<{
        isError: boolean;
        data?: any;
        error?: string;
        isCancelled?: boolean;
        remediation?: string;
    }>;
    /**
     * Directly invokes the real upstream REA MCP server via StdioClientTransport.
     */
    private invokeReaMcpTool;
    private findFiles;
}
