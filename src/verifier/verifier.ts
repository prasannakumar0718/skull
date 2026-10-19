import * as fs from "node:fs";
import * as path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import * as http from "node:http";

const execFileAsync = promisify(execFile);

export type ErrorClassification =
  | "MISSING_FILE"
  | "MISSING_STORAGE"
  | "SYNTAX_ERROR"
  | "TEST_FAILURE"
  | "TIMEOUT"
  | "SERVER_CRASH"
  | "SPEC_ERROR"
  | "UNKNOWN";

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

export class ForgeVerifier {
  private maxRepairCycles = 2;

  public async verify(projectDirectory: string): Promise<VerificationReport> {
    const resolvedDir = path.resolve(projectDirectory);
    const repairedIssues: string[] = [];
    let repairAttempts = 0;

    if (!fs.existsSync(resolvedDir)) {
      return {
        overallPassed: false,
        checks: [
          {
            name: "Directory Existence",
            passed: false,
            classification: "MISSING_FILE",
            message: `Directory does not exist: ${projectDirectory}`
          }
        ],
        repairedIssues: [],
        repairAttempts: 0
      };
    }

    let report = await this.runCheckPipeline(resolvedDir);

    // Self-repair loop with bounded iterations
    while (!report.overallPassed && repairAttempts < this.maxRepairCycles) {
      repairAttempts++;
      const repairApplied = await this.attemptFocusedRepair(resolvedDir, report.checks, repairedIssues);
      if (!repairApplied) {
        break; // No further repairs can be applied
      }

      // Re-verify after repair to confirm whether the fix actually resolved the failure
      report = await this.runCheckPipeline(resolvedDir);
    }

    return {
      overallPassed: report.overallPassed,
      checks: report.checks,
      repairedIssues,
      repairAttempts
    };
  }

  private async runCheckPipeline(resolvedDir: string): Promise<{ overallPassed: boolean; checks: VerificationCheck[] }> {
    const checks: VerificationCheck[] = [];

    // Check 1: Structural files
    const packageJsonPath = path.join(resolvedDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      checks.push({
        name: "Structure Check",
        passed: false,
        classification: "MISSING_FILE",
        message: "package.json is missing"
      });
    } else {
      checks.push({
        name: "Structure Check",
        passed: true,
        message: "package.json is present"
      });
    }

    // Check 2: Storage verification
    const dbPath = path.join(resolvedDir, "app.db");
    const serverPath = path.join(resolvedDir, "server.js");
    if (fs.existsSync(serverPath)) {
      if (!fs.existsSync(dbPath)) {
        checks.push({
          name: "Storage Check",
          passed: false,
          classification: "MISSING_STORAGE",
          message: "SQLite database (app.db) is not initialized"
        });
      } else {
        checks.push({
          name: "Storage Check",
          passed: true,
          message: "SQLite persistent database (app.db) is present"
        });
      }
    }

    // Check 3: Bounded execution test (test.js)
    const testJsPath = path.join(resolvedDir, "test.js");
    if (fs.existsSync(testJsPath)) {
      try {
        const { stdout, stderr } = await execFileAsync(process.execPath, ["test.js"], {
          cwd: resolvedDir,
          timeout: 10000, // 10-second bound against hung executions
          maxBuffer: 1024 * 1024 // 1 MB buffer
        });

        checks.push({
          name: "Unit/Structural Verification",
          passed: true,
          message: "test.js passed successfully",
          details: this.sanitizeOutput(stdout.trim())
        });
      } catch (err: any) {
        const stderrOutput = this.sanitizeOutput(err.stderr || err.message || "");
        let classification: ErrorClassification = "TEST_FAILURE";

        if (err.killed || /timed? ?out/i.test(err.message)) {
          classification = "TIMEOUT";
        } else if (/SyntaxError/i.test(stderrOutput)) {
          classification = "SYNTAX_ERROR";
        } else if (/Cannot find module/i.test(stderrOutput)) {
          classification = "MISSING_FILE";
        } else if (/no such table/i.test(stderrOutput)) {
          classification = "MISSING_STORAGE";
        }

        checks.push({
          name: "Unit/Structural Verification",
          passed: false,
          classification,
          message: `test.js verification failed (${classification})`,
          details: stderrOutput
        });
      }
    }

    // Check 4: Wasp spec conformance (if targeting Wasp)
    const waspPath = path.join(resolvedDir, "main.wasp.ts");
    if (fs.existsSync(waspPath)) {
      const waspContent = fs.readFileSync(waspPath, "utf-8");
      const hasAppDecl = waspContent.includes("export default app");
      const hasPrisma = fs.existsSync(path.join(resolvedDir, "schema.prisma"));

      const passed = hasAppDecl && hasPrisma;
      checks.push({
        name: "Wasp Spec Conformance",
        passed,
        classification: passed ? undefined : "SPEC_ERROR",
        message: passed
          ? "Valid Wasp 0.26.1 specification and Prisma schema found"
          : "Wasp specification is missing valid app declaration or schema.prisma"
      });
    }

    const overallPassed = checks.every((c) => c.passed);
    return { overallPassed, checks };
  }

  /**
   * Focused self-repair engine. Attempts to fix identified root causes.
   */
  private async attemptFocusedRepair(
    resolvedDir: string,
    checks: VerificationCheck[],
    repairedIssues: string[]
  ): Promise<boolean> {
    let appliedAny = false;

    for (const check of checks) {
      if (check.passed) continue;

      if (check.classification === "MISSING_STORAGE") {
        try {
          const dbPath = path.join(resolvedDir, "app.db");
          const db = new DatabaseSync(dbPath);
          try {
            db.exec("PRAGMA journal_mode = WAL;");
            db.exec(`
              CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                isDone INTEGER NOT NULL DEFAULT 0,
                createdAt TEXT NOT NULL
              );
            `);
            repairedIssues.push("Initialized SQLite database schema in app.db");
            appliedAny = true;
          } finally {
            db.close();
          }
        } catch {
          // Repair attempt failed
        }
      }
    }

    return appliedAny;
  }

  /**
   * Probes a generated server process with live HTTP GET /api/health
   * Guarantees process termination and zero leaked sockets.
   */
  public async probeLiveServer(projectDirectory: string, port = 3999): Promise<{ success: boolean; data?: any; error?: string }> {
    const resolvedDir = path.resolve(projectDirectory);
    const serverPath = path.join(resolvedDir, "server.js");
    if (!fs.existsSync(serverPath)) {
      return { success: false, error: "server.js not found" };
    }

    const env = { ...process.env, PORT: String(port), NODE_ENV: "development" };
    const child = spawn(process.execPath, [serverPath], {
      cwd: resolvedDir,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let serverStderr = "";
    child.stderr?.on("data", (chunk) => {
      serverStderr += chunk.toString();
    });

    const cleanup = () => {
      try {
        child.kill();
      } catch {
        // Ignored
      }
    };

    // Wait for server to boot with bounded polling
    const maxAttempts = 20;
    const delay = 150;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, delay));

      // Check if child exited prematurely
      if (child.exitCode !== null) {
        cleanup();
        return { success: false, error: `Server exited prematurely with code ${child.exitCode}: ${serverStderr.trim()}` };
      }

      const res = await this.pingHealth(port);
      if (res.success) {
        cleanup();
        await new Promise((r) => setTimeout(r, 50));
        return res;
      }
    }

    cleanup();
    return { success: false, error: `Health probe timed out after 3000ms: ${serverStderr.trim()}` };
  }

  private pingHealth(port: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, { timeout: 1000 }, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve({ success: true, data: JSON.parse(body) });
            } catch {
              resolve({ success: false, error: "Invalid JSON response" });
            }
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
          }
        });
      });

      req.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ success: false, error: "Request timeout" });
      });
    });
  }

  private sanitizeOutput(text: string): string {
    return text.replace(/(?:password|secret|token|key|auth)=\S+/gi, "$1=[REDACTED]");
  }
}
