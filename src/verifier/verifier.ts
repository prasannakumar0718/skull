import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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

export class ForgeVerifier {
  public async verify(projectDirectory: string): Promise<VerificationReport> {
    const checks: VerificationCheck[] = [];
    const repairedIssues: string[] = [];
    const resolvedDir = path.resolve(projectDirectory);

    if (!fs.existsSync(resolvedDir)) {
      return {
        overallPassed: false,
        checks: [{ name: "Directory Existence", passed: false, message: `Directory does not exist: ${projectDirectory}` }],
        repairedIssues: []
      };
    }

    // Check 1: Structural files
    const packageJsonPath = path.join(resolvedDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      checks.push({ name: "Structure Check", passed: false, message: "package.json is missing" });
    } else {
      checks.push({ name: "Structure Check", passed: true, message: "package.json is present" });
    }

    // Check 2: Automatic Repair - ensure data.json storage file is initialized
    const dataJsonPath = path.join(resolvedDir, "data.json");
    if (!fs.existsSync(dataJsonPath) && fs.existsSync(path.join(resolvedDir, "server.js"))) {
      try {
        fs.writeFileSync(dataJsonPath, JSON.stringify({ tasks: [] }, null, 2), "utf-8");
        repairedIssues.push("Initialized missing data.json persistent storage file");
      } catch (err: any) {
        checks.push({ name: "Self-Repair", passed: false, message: `Failed to initialize data.json: ${err.message}` });
      }
    }

    // Check 3: Syntax / Node execution check
    if (fs.existsSync(path.join(resolvedDir, "test.js"))) {
      try {
        const { stdout, stderr } = await execAsync("node test.js", { cwd: resolvedDir });
        checks.push({
          name: "Unit/Structural Verification",
          passed: true,
          message: "test.js passed successfully",
          details: stdout.trim()
        });
      } catch (err: any) {
        checks.push({
          name: "Unit/Structural Verification",
          passed: false,
          message: "test.js verification failed",
          details: err.stderr || err.message
        });
      }
    }

    // Check 4: Wasp specification validation (if present)
    if (fs.existsSync(path.join(resolvedDir, "main.wasp.ts"))) {
      const waspContent = fs.readFileSync(path.join(resolvedDir, "main.wasp.ts"), "utf-8");
      const hasAppDecl = waspContent.includes("export default app");
      checks.push({
        name: "Wasp Spec Conformance",
        passed: hasAppDecl,
        message: hasAppDecl ? "Valid export default app declaration found" : "Missing export default app"
      });
    }

    const overallPassed = checks.every((c) => c.passed);
    return {
      overallPassed,
      checks,
      repairedIssues
    };
  }
}
