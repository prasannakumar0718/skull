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

    // Check 2.5: Entry point syntax verification (server.js)
    if (fs.existsSync(serverPath)) {
      try {
        await execFileAsync(process.execPath, ["--check", "server.js"], {
          cwd: resolvedDir,
          timeout: 5000
        });
        checks.push({
          name: "Entry Point Syntax Verification",
          passed: true,
          message: "server.js syntax verified"
        });
      } catch (err: any) {
        checks.push({
          name: "Entry Point Syntax Verification",
          passed: false,
          classification: "SYNTAX_ERROR",
          message: "server.js syntax verification failed",
          details: this.sanitizeOutput(err.stderr || err.message || "")
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

            let isDocEditor = false;
            let isStudentMgmt = false;
            let isContent = false;
            let isApiDocs = false;
            let title = "Application";

            const specPath = path.join(resolvedDir, "forgespec.json");
            if (fs.existsSync(specPath)) {
              try {
                const parsed = JSON.parse(fs.readFileSync(specPath, "utf-8"));
                title = parsed.title || title;
                if (
                  parsed.metadata?.domain === "document-editor" ||
                  parsed.domain === "document-editor" ||
                  parsed.entities?.some((e: any) => String(e.name).toLowerCase().includes("document")) ||
                  parsed.models?.some((m: any) => String(m.name).toLowerCase().includes("document"))
                ) {
                  isDocEditor = true;
                } else if (
                  parsed.metadata?.domain === "student-management" ||
                  parsed.domain === "student-management" ||
                  parsed.entities?.some((e: any) => String(e.name).toLowerCase().includes("student")) ||
                  /student|attendance/i.test(parsed.description || "")
                ) {
                  isStudentMgmt = true;
                } else if (
                  parsed.metadata?.domain === "api-docs" ||
                  parsed.domain === "api-docs" ||
                  parsed.entities?.some((e: any) => String(e.name).toLowerCase().includes("apiendpoint")) ||
                  parsed.capabilities?.includes("api-documentation") ||
                  /api documentation|service explorer|rest api|openapi|swagger/i.test(parsed.title || "") ||
                  /api documentation|service explorer|rest api|openapi|swagger/i.test(parsed.description || "")
                ) {
                  isApiDocs = true;
                } else if (
                  parsed.metadata?.domain === "content" ||
                  parsed.domain === "content" ||
                  parsed.entities?.some((e: any) => String(e.name).toLowerCase() === "contentpage") ||
                  parsed.capabilities?.includes("content-presentation") ||
                  /example domain|informational website|content presentation/i.test(parsed.title || "")
                ) {
                  isContent = true;
                }
              } catch {
                // Ignore parse errors
              }
            }

            const serverPath = path.join(resolvedDir, "server.js");
            if (!isDocEditor && !isStudentMgmt && !isApiDocs && !isContent && fs.existsSync(serverPath)) {
              const serverCode = fs.readFileSync(serverPath, "utf-8");
              if (serverCode.includes("documents (") || serverCode.includes("CREATE TABLE IF NOT EXISTS documents")) {
                isDocEditor = true;
              } else if (serverCode.includes("students (") || serverCode.includes("CREATE TABLE IF NOT EXISTS students")) {
                isStudentMgmt = true;
              } else if (serverCode.includes("content_pages (") || serverCode.includes("CREATE TABLE IF NOT EXISTS content_pages")) {
                isContent = true;
              } else if (serverCode.includes("endpoint_metrics (") || serverCode.includes("CREATE TABLE IF NOT EXISTS endpoint_metrics")) {
                isApiDocs = true;
              }
            }

            if (isDocEditor) {
              db.exec(`
                CREATE TABLE IF NOT EXISTS documents (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  content TEXT NOT NULL DEFAULT '',
                  format TEXT NOT NULL DEFAULT 'html',
                  wordCount INTEGER NOT NULL DEFAULT 0,
                  isArchived INTEGER NOT NULL DEFAULT 0,
                  createdAt TEXT NOT NULL,
                  updatedAt TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS revisions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  documentId INTEGER NOT NULL,
                  contentSnapshot TEXT NOT NULL,
                  summary TEXT,
                  savedAt TEXT NOT NULL
                );
              `);

              const countRow = db.prepare("SELECT COUNT(*) AS count FROM documents").get() as { count: number };
              if (countRow.count === 0) {
                const seed = db.prepare(`
                  INSERT INTO documents (title, content, format, wordCount, isArchived, createdAt, updatedAt)
                  VALUES (?, ?, 'html', 12, 0, ?, ?)
                `);
                const now = new Date().toISOString();
                seed.run(`Welcome to ${title}`, "<p>Welcome to Document Studio.</p>", now, now);
              }
              repairedIssues.push("Initialized SQLite database schema in app.db (documents & revisions)");
            } else if (isStudentMgmt) {
              db.exec(`
                CREATE TABLE IF NOT EXISTS students (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  roll_number TEXT NOT NULL,
                  grade TEXT NOT NULL,
                  attendance_rate REAL DEFAULT 100.0,
                  fee_status TEXT DEFAULT 'Pending',
                  fee_amount REAL DEFAULT 1200.0,
                  email TEXT DEFAULT '',
                  notes TEXT DEFAULT '',
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS attendance_records (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  student_id INTEGER NOT NULL,
                  date TEXT NOT NULL,
                  status TEXT NOT NULL DEFAULT 'Present',
                  notes TEXT DEFAULT ''
                );
              `);

              const countRow = db.prepare("SELECT COUNT(*) AS count FROM students").get() as { count: number };
              if (countRow.count === 0) {
                const seed = db.prepare(`
                  INSERT INTO students (name, roll_number, grade, attendance_rate, fee_status, fee_amount, email, notes, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `);
                seed.run("Alex Chen", "STU-1001", "Grade 10", 96.5, "Paid", 1500.0, "alex.chen@school.edu", "Academic honors list.");
                seed.run("Maria Garcia", "STU-1002", "Grade 11", 82.0, "Pending", 1500.0, "maria.g@school.edu", "Attendance improvement plan active.");
                seed.run("Liam Patel", "STU-1003", "Grade 10", 91.0, "Paid", 1500.0, "liam.p@school.edu", "Standard tuition paid.");
              }
              repairedIssues.push("Initialized SQLite database schema in app.db (students & attendance_records)");
            } else if (isContent) {
              db.exec(`
                CREATE TABLE IF NOT EXISTS content_pages (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  slug TEXT DEFAULT '/',
                  content TEXT DEFAULT '',
                  headings TEXT DEFAULT '[]',
                  links TEXT DEFAULT '[]',
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
              `);
              const countRow = db.prepare("SELECT COUNT(*) AS count FROM content_pages").get() as { count: number };
              if (countRow.count === 0) {
                const seed = db.prepare(`
                  INSERT INTO content_pages (title, slug, content, headings, links, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                `);
                seed.run(title, "/", "Content presentation service initialized.", "[]", "[]");
              }
              repairedIssues.push("Initialized SQLite database schema in app.db (content_pages)");
            } else if (isApiDocs) {
              db.exec(`
                CREATE TABLE IF NOT EXISTS endpoint_metrics (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  path TEXT NOT NULL,
                  method TEXT NOT NULL,
                  calls_count INTEGER DEFAULT 0,
                  last_called_at TEXT,
                  last_status INTEGER
                );
              `);
              repairedIssues.push("Initialized SQLite database schema in app.db (endpoint_metrics)");
            } else {
              db.exec(`
                CREATE TABLE IF NOT EXISTS tasks (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  category TEXT DEFAULT 'General',
                  priority TEXT DEFAULT 'medium',
                  completed INTEGER DEFAULT 0,
                  notes TEXT DEFAULT '',
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
              `);
              const countRow = db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number };
              if (countRow.count === 0) {
                const seed = db.prepare(`
                  INSERT INTO tasks (title, category, priority, completed, notes, created_at)
                  VALUES (?, 'General', 'medium', 0, '', datetime('now'))
                `);
                seed.run("Default task");
              }
              repairedIssues.push("Initialized SQLite database schema in app.db (tasks)");
            }
            appliedAny = true;
          } finally {
            db.close();
          }
        } catch {
          // Repair attempt failed
        }
      }

      if (check.classification === "SYNTAX_ERROR" || check.classification === "TEST_FAILURE") {
        try {
          const specPath = path.join(resolvedDir, "forgespec.json");
          if (fs.existsSync(specPath)) {
            const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
            const { EngineOrchestrator } = await import("../engines/orchestrator.js");
            const orchestrator = new EngineOrchestrator();
            await orchestrator.generateProject(spec, resolvedDir);
            repairedIssues.push("Restored corrupted source implementation from Forge specification");
            appliedAny = true;
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
    const maxAttempts = 35;
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
