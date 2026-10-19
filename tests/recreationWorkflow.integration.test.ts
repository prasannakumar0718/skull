import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RecreationOrchestrator } from "../src/recreation/orchestrator.js";
import { ForgeVerifier } from "../src/verifier/verifier.js";
import { spawn, ChildProcess } from "node:child_process";
import * as http from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";

function makeRequest(method: string, url: string, body?: any): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { "Content-Type": "application/json" }
    };
    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode || 0, data: raw ? JSON.parse(raw) : {} });
        } catch {
          resolve({ statusCode: res.statusCode || 0, data: raw });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("Phase 13: End-to-End Pilot Recreation & Behavioral Verification", () => {
  const referenceTarget = path.resolve("./fixtures/reference-document-app");
  const recreatedAppDir = path.resolve("./temp_pilot_recreated_app");
  const refPort = 58930;
  const recPort = 58931;

  let refProcess: ChildProcess | null = null;
  let recProcess: ChildProcess | null = null;
  let restartProcess: ChildProcess | null = null;

  beforeAll(async () => {
    if (fs.existsSync(recreatedAppDir)) {
      fs.rmSync(recreatedAppDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    if (refProcess) {
      try { refProcess.kill(); } catch {}
    }
    if (recProcess) {
      try { recProcess.kill(); } catch {}
    }
    if (restartProcess) {
      try { restartProcess.kill(); } catch {}
    }
    await new Promise((r) => setTimeout(r, 400));
    if (fs.existsSync(recreatedAppDir)) {
      try {
        fs.rmSync(recreatedAppDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it("executes complete recreation pilot: investigate -> specify -> plan -> build -> verify -> compare", async () => {
    const orchestrator = new RecreationOrchestrator();

    // 1. Submit recreation request with reference target
    const result = await orchestrator.recreate({
      prompt: "Recreate the document editor workflow with rich-text editing, formatting, autosave, and export",
      targetPath: referenceTarget,
      outputDirectory: recreatedAppDir,
      targetEngine: "fullstack-node",
      compare: true
    });

    // 2. Validate investigation
    expect(result.mode).toBe("reference_driven");
    expect(result.investigation.targetType).toBe("source_code");
    expect(result.investigation.evidence.length).toBeGreaterThan(0);
    expect(result.investigation.observedCapabilities).toContain("persistent-sqlite-storage");
    expect(result.investigation.observedCapabilities).toContain("document-export");

    // 3. Validate evidence-based specification
    expect(result.spec.entities.some((e) => e.name === "Document")).toBe(true);
    expect(result.spec.workflows).toBeDefined();
    expect(result.spec.workflows!.length).toBeGreaterThanOrEqual(3);

    // 4. Validate implementation plan
    expect(result.plan).toBeDefined();
    expect(result.plan.tasks.length).toBeGreaterThanOrEqual(5);
    expect(fs.existsSync(path.join(recreatedAppDir, "implementation-plan.json"))).toBe(true);

    // 5. Validate generated application structure
    expect(fs.existsSync(path.join(recreatedAppDir, "server.js"))).toBe(true);
    expect(fs.existsSync(path.join(recreatedAppDir, "app.db"))).toBe(true);
    expect(fs.existsSync(path.join(recreatedAppDir, "public", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(recreatedAppDir, "public", "style.css"))).toBe(true);
    expect(fs.existsSync(path.join(recreatedAppDir, "public", "app.js"))).toBe(true);

    // 6. Validate verification report
    expect(result.verification).toBeDefined();
    expect(result.verification!.overallPassed).toBe(true);

    // 7. Validate behavioral comparison
    expect(result.comparison).toBeDefined();
    expect(result.comparison!.overallStatus).toBe("pass");
    expect(result.comparison!.summary.passed).toBeGreaterThanOrEqual(3);
  }, 45000);

  it("verifies live observable workflows against both reference and recreated applications", async () => {
    // Start reference app server
    refProcess = spawn(process.execPath, ["server.js"], {
      cwd: referenceTarget,
      env: { ...process.env, PORT: String(refPort), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    // Start recreated app server
    recProcess = spawn(process.execPath, ["server.js"], {
      cwd: recreatedAppDir,
      env: { ...process.env, PORT: String(recPort), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await new Promise((r) => setTimeout(r, 800));

    // Workflow 1: Document Creation
    const refCreate = await makeRequest("POST", `http://127.0.0.1:${refPort}/api/documents`, {
      title: "Reference Workflow Test",
      content: "<p>Original document content</p>"
    });
    expect(refCreate.statusCode).toBe(201);
    expect(refCreate.data.id).toBeDefined();

    const recCreate = await makeRequest("POST", `http://127.0.0.1:${recPort}/api/documents`, {
      title: "Recreation Workflow Test",
      content: "<p>Recreated document content</p>"
    });
    expect(recCreate.statusCode).toBe(201);
    expect(recCreate.data.id).toBeDefined();
    const recId = recCreate.data.id;

    // Workflow 2: Content Autosave / PATCH
    const recAutosave = await makeRequest("PATCH", `http://127.0.0.1:${recPort}/api/documents/${recId}`, {
      content: "<h1>Updated Title</h1><p>Autosaved content modification.</p>"
    });
    expect(recAutosave.statusCode).toBe(200);
    expect(recAutosave.data.wordCount).toBeGreaterThan(0);

    // Workflow 3: Multi-Format Export (Markdown & HTML)
    const exportMd = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/documents/${recId}/export?format=markdown`);
    expect(exportMd.statusCode).toBe(200);
    expect(String(exportMd.data)).toContain("# Updated Title");

    const exportHtml = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/documents/${recId}/export?format=html`);
    expect(exportHtml.statusCode).toBe(200);
    expect(String(exportHtml.data)).toContain("<!DOCTYPE html>");

    // Kill recreated server instance
    recProcess.kill();
    recProcess = null;
    await new Promise((r) => setTimeout(r, 400));
  }, 45000);

  it("detects deliberate implementation defect and applies bounded self-repair", async () => {
    // Inject defect: delete app.db to simulate storage missing fault
    const dbFile = path.join(recreatedAppDir, "app.db");
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
    expect(fs.existsSync(dbFile)).toBe(false);

    // Run verifier: must identify MISSING_STORAGE and apply focused self-repair
    const verifier = new ForgeVerifier();
    const report = await verifier.verify(recreatedAppDir);

    expect(report.repairAttempts).toBeGreaterThan(0);
    expect(report.repairedIssues.some((r) => r.includes("SQLite"))).toBe(true);
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(report.overallPassed).toBe(true);
  }, 30000);

  it("verifies persistence across process termination and cold restart", async () => {
    // Start recreated server again
    restartProcess = spawn(process.execPath, ["server.js"], {
      cwd: recreatedAppDir,
      env: { ...process.env, PORT: String(recPort), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await new Promise((r) => setTimeout(r, 800));

    // Verify documents API returns documents from persistent SQLite storage
    const listRes = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/documents`);
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.data)).toBe(true);
    expect(listRes.data.length).toBeGreaterThan(0);

    if (restartProcess) {
      restartProcess.kill();
      restartProcess = null;
    }
    await new Promise((r) => setTimeout(r, 400));
  }, 30000);
});
