export interface VerificationCheck {
    name: string;
    passed: boolean;
    message: string;
    details?: string;
}
export interface VerificationReport {
    overallPassed: boolean;
    checks: VerificationCheck[];
    repairedIssues: string[];
}
export declare class ForgeVerifier {
    verify(projectDirectory: string): Promise<VerificationReport>;
}
