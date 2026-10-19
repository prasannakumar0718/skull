export type ErrorClassification = "MISSING_FILE" | "MISSING_STORAGE" | "SYNTAX_ERROR" | "TEST_FAILURE" | "TIMEOUT" | "SERVER_CRASH" | "SPEC_ERROR" | "UNKNOWN";
export interface VerificationCheck {
    name: string;
    passed: boolean;
    message: string;
    classification?: ErrorClassification;
    details?: string;
}
export interface VerificationReport {
    overallPassed: boolean;
    checks: VerificationCheck[];
    repairedIssues: string[];
    repairAttempts: number;
}
export declare class ForgeVerifier {
    private maxRepairCycles;
    verify(projectDirectory: string): Promise<VerificationReport>;
    private runCheckPipeline;
    /**
     * Focused self-repair engine. Attempts to fix identified root causes.
     */
    private attemptFocusedRepair;
    /**
     * Probes a generated server process with live HTTP GET /api/health
     * Guarantees process termination and zero leaked sockets.
     */
    probeLiveServer(projectDirectory: string, port?: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    private pingHealth;
    private sanitizeOutput;
}
