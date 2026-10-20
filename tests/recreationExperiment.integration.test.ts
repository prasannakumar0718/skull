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

describe("Phase 13.1 Acceptance Experiment: INVESTIGATE -> SPECIFY -> BUILD -> RUN -> COMPARE -> DETECT FAILURE -> REPAIR -> RE-VERIFY", () => {
  const referenceTarget = path.resolve("./fixtures/reference-document-app");
  const experimentAppDir = path.resolve("./temp_phase13_recreation_experiment");
  const refPort = 49140;
  const recPort = 49141;

  let refProcess: ChildProcess | null = null;
  let recProcess: ChildProcess | null = null;

  beforeAll(async () => {
    if (fs.existsSync(experimentAppDir)) {
      try {
        fs.rmSync(experimentAppDir, { recursive: true, force: true });
      } catch {}
    }
  });

  afterAll(async () => {
    if (refProcess) {
      try { refProcess.kill(); } catch {}
    }
    if (recProcess) {
      try { recProcess.kill(); } catch {}
    }
    await new Promise((r) => setTimeout(r, 400));
    if (fs.existsSync(experimentAppDir)) {
      try {
        fs.rmSync(experimentAppDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {}
    }
  });

  it("Step 1 & 2 (INVESTIGATE & SPECIFY & PLAN): executes real REA tools, extracts evidence, workflows, and strict provenance", async () => {
    const orchestrator = new RecreationOrchestrator();
    const prompt = "Recreate Document Studio reference application with rich-text editing, renaming, autosave, and export";
    
    // Execute end-to-end recreation pipeline
    const result = await orchestrator.recreate({
      prompt,
      targetPath: referenceTarget,
      outputDirectory: experimentAppDir,
      targetEngine: "fullstack-node",
      compare: true
    });

    const investigation = result.investigation;
    expect(investigation.mode).toBe("reference_driven");
    expect(investigation.targetType).toBe("source_code");
    expect(investigation.evidence.length).toBeGreaterThan(0);

    // Verify real REA tool invocations are recorded in evidence
    const hasSqliteEvidence = investigation.evidence.some(e => e.kind === "schema" && e.sourcePath.endsWith(".db"));
    expect(hasSqliteEvidence).toBe(true);

    const hasArtifactEvidence = investigation.evidence.some(e => e.kind === "bundle" || e.kind === "routes");
    expect(hasArtifactEvidence).toBe(true);

    // Verify observed capabilities
    expect(investigation.observedCapabilities).toContain("persistent-sqlite-storage");
    expect(investigation.observedCapabilities).toContain("document-create");
    expect(investigation.observedCapabilities).toContain("document-rename");
    expect(investigation.observedCapabilities).toContain("document-delete");
    expect(investigation.observedCapabilities).toContain("document-export");

    // Verify explicit limitations are recorded honestly
    expect(investigation.limitations.length).toBeGreaterThan(0);
    expect(investigation.limitations.some(l => l.includes("REA provides static"))).toBe(true);

    // Verify synthesized strict evidence-based ForgeSpec
    const spec = result.spec;
    expect(spec.entities.some(e => e.name === "Document")).toBe(true);
    expect(spec.workflows).toBeDefined();
    expect(spec.workflows!.length).toBeGreaterThanOrEqual(4);

    // Verify all 3 primary workflows + export are present with observed provenance
    const wfIds = spec.workflows!.map(w => w.id);
    expect(wfIds).toContain("wf_create_rename");
    expect(wfIds).toContain("wf_edit_save");
    expect(wfIds).toContain("wf_delete_confirm");
    expect(wfIds).toContain("wf_ref_export");

    // Verify coverage assessment
    expect(spec.coverageAssessment).toBeDefined();
    expect(spec.coverageAssessment!.observedWorkflows).toBeGreaterThanOrEqual(3);
    expect(spec.coverageAssessment!.confidenceScore).toBeGreaterThanOrEqual(0.85);

    // Verify staged implementation plan
    const plan = result.plan;
    expect(plan.tasks.length).toBeGreaterThanOrEqual(5);
    expect(plan.architecture.storage).toContain("SQLite");
    expect(plan.acceptanceCriteria.length).toBeGreaterThan(5);

    // Verify generated application files on disk
    expect(fs.existsSync(path.join(experimentAppDir, "server.js"))).toBe(true);
    expect(fs.existsSync(path.join(experimentAppDir, "public", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(experimentAppDir, "public", "style.css"))).toBe(true);
    expect(fs.existsSync(path.join(experimentAppDir, "public", "app.js"))).toBe(true);
    expect(fs.existsSync(path.join(experimentAppDir, "test.js"))).toBe(true);
    expect(fs.existsSync(path.join(experimentAppDir, "app.db"))).toBe(true);
    expect(fs.existsSync(path.join(experimentAppDir, "forgespec.json"))).toBe(true);
    expect(fs.existsSync(path.join(experimentAppDir, "implementation-plan.json"))).toBe(true);

    // Verify verification passed
    expect(result.verification.overallPassed).toBe(true);
    expect(result.comparison).toBeDefined();
    expect(["pass", "partial"]).toContain(result.comparison!.overallStatus);
  }, 45000);

  it("Step 3 & 4 (RUN & PROBE): launches both reference and recreation servers and verifies health", async () => {

    // Launch Reference server
    refProcess = spawn(process.execPath, ["server.js"], {
      cwd: referenceTarget,
      env: { ...process.env, PORT: String(refPort), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    // Launch Recreated server
    recProcess = spawn(process.execPath, ["server.js"], {
      cwd: experimentAppDir,
      env: { ...process.env, PORT: String(recPort), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await new Promise((r) => setTimeout(r, 800));

    // Verify both health endpoints respond with HTTP 200 OK
    const refHealth = await makeRequest("GET", `http://127.0.0.1:${refPort}/api/health`);
    expect(refHealth.statusCode).toBe(200);

    const recHealth = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/health`);
    expect(recHealth.statusCode).toBe(200);
  }, 45000);

  it("Step 5 (COMPARE): executes real observable workflows concurrently against both reference and recreated applications", async () => {
    // -------------------------------------------------------------
    // Workflow 1: Create and Rename a Record
    // -------------------------------------------------------------
    const refCreate = await makeRequest("POST", `http://127.0.0.1:${refPort}/api/documents`, {
      title: "Initial Doc",
      content: "<p>Original initial content</p>"
    });
    expect(refCreate.statusCode).toBe(201);
    const refId = refCreate.data.id;

    const recCreate = await makeRequest("POST", `http://127.0.0.1:${recPort}/api/documents`, {
      title: "Initial Doc",
      content: "<p>Recreated initial content</p>"
    });
    expect(recCreate.statusCode).toBe(201);
    const recId = recCreate.data.id;

    // Rename on both
    const refRename = await makeRequest("PATCH", `http://127.0.0.1:${refPort}/api/documents/${refId}`, {
      title: "Renamed Pilot Title"
    });
    expect(refRename.statusCode).toBe(200);
    expect(refRename.data.title).toBe("Renamed Pilot Title");

    const recRename = await makeRequest("PATCH", `http://127.0.0.1:${recPort}/api/documents/${recId}`, {
      title: "Renamed Pilot Title"
    });
    expect(recRename.statusCode).toBe(200);
    expect(recRename.data.title).toBe("Renamed Pilot Title");

    // -------------------------------------------------------------
    // Workflow 2: Edit and Autosave Content
    // -------------------------------------------------------------
    const refEdit = await makeRequest("PATCH", `http://127.0.0.1:${refPort}/api/documents/${refId}`, {
      content: "<h1>Architecture Heading</h1><p>Edited autosave body.</p>"
    });
    expect(refEdit.statusCode).toBe(200);

    const recEdit = await makeRequest("PATCH", `http://127.0.0.1:${recPort}/api/documents/${recId}`, {
      content: "<h1>Architecture Heading</h1><p>Edited autosave body.</p>"
    });
    expect(recEdit.statusCode).toBe(200);
    expect(recEdit.data.wordCount).toBeGreaterThanOrEqual(4);

    // -------------------------------------------------------------
    // Workflow 3: Multi-Format Document Export
    // -------------------------------------------------------------
    const refExportMd = await makeRequest("GET", `http://127.0.0.1:${refPort}/api/documents/${refId}/export?format=markdown`);
    expect(refExportMd.statusCode).toBe(200);
    expect(String(refExportMd.data)).toContain("# Renamed Pilot Title");

    const recExportMd = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/documents/${recId}/export?format=markdown`);
    expect(recExportMd.statusCode).toBe(200);
    expect(String(recExportMd.data)).toContain("# Renamed Pilot Title");

    const recExportHtml = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/documents/${recId}/export?format=html`);
    expect(recExportHtml.statusCode).toBe(200);
    expect(String(recExportHtml.data)).toContain("<!DOCTYPE html>");

    const recExportDoc = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/documents/${recId}/export?format=doc`);
    expect(recExportDoc.statusCode).toBe(200);
    expect(String(recExportDoc.data)).toContain("urn:schemas-microsoft-com:office:word");

    // -------------------------------------------------------------
    // Workflow 4: Delete Record and Confirm Resulting State
    // -------------------------------------------------------------
    const refDelete = await makeRequest("DELETE", `http://127.0.0.1:${refPort}/api/documents/${refId}`);
    expect(refDelete.statusCode).toBe(200);
    const refConfirm = await makeRequest("GET", `http://127.0.0.1:${refPort}/api/documents/${refId}`);
    expect(refConfirm.statusCode).toBe(404);

    const recDelete = await makeRequest("DELETE", `http://127.0.0.1:${recPort}/api/documents/${recId}`);
    expect(recDelete.statusCode).toBe(200);
    const recConfirm = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/documents/${recId}`);
    expect(recConfirm.statusCode).toBe(404);

    // Terminate running processes before defect test
    if (recProcess) {
      recProcess.kill();
      recProcess = null;
    }
    if (refProcess) {
      refProcess.kill();
      refProcess = null;
    }
    await new Promise((r) => setTimeout(r, 400));
  }, 45000);

  it("Step 6, 7 & 8 (DETECT FAILURE, REPAIR & RE-VERIFY): detects controlled defect, applies bounded self-repair, and confirms restoration", async () => {
    const serverPath = path.join(experimentAppDir, "server.js");
    expect(fs.existsSync(serverPath)).toBe(true);

    // 1. Introduce a controlled, reversible defect into the generated application
    // Simulating broken save handler / corrupted syntax
    fs.writeFileSync(serverPath, "INVALID JAVASCRIPT SYNTAX (simulated defect in save handler) ::: ;;;", "utf-8");

    // 2. DETECT FAILURE: Run verifier pipeline
    const verifier = new ForgeVerifier();
    const brokenPipeline = await (verifier as any).runCheckPipeline(experimentAppDir);
    expect(brokenPipeline.overallPassed).toBe(false);

    const syntaxCheck = brokenPipeline.checks.find((c: any) => c.classification === "SYNTAX_ERROR");
    expect(syntaxCheck).toBeDefined();
    expect(syntaxCheck.passed).toBe(false);

    // 3. REPAIR: Execute automated bounded self-repair
    // The verifier reads forgespec.json and restores the clean server implementation
    const repairReport = await verifier.verify(experimentAppDir);

    expect(repairReport.repairAttempts).toBeGreaterThan(0);
    expect(repairReport.repairedIssues.some((r: string) => r.includes("Restored corrupted source implementation"))).toBe(true);
    expect(repairReport.overallPassed).toBe(true);

    // 4. RE-VERIFY: Launch the repaired application and verify normal operations are restored
    recProcess = spawn(process.execPath, ["server.js"], {
      cwd: experimentAppDir,
      env: { ...process.env, PORT: String(recPort), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await new Promise((r) => setTimeout(r, 800));

    // Re-verify health
    const health = await makeRequest("GET", `http://127.0.0.1:${recPort}/api/health`);
    expect(health.statusCode).toBe(200);

    // Re-verify document creation and persistence
    const reCreate = await makeRequest("POST", `http://127.0.0.1:${recPort}/api/documents`, {
      title: "Post-Repair Verified Document",
      content: "<p>Verification after automated self-repair.</p>"
    });
    expect(reCreate.statusCode).toBe(201);
    expect(reCreate.data.id).toBeDefined();

    const repairedDocId = reCreate.data.id;
    const reRename = await makeRequest("PATCH", `http://127.0.0.1:${recPort}/api/documents/${repairedDocId}`, {
      title: "Final Verified Document"
    });
    expect(reRename.statusCode).toBe(200);
    expect(reRename.data.title).toBe("Final Verified Document");

    // Clean up post-test document
    await makeRequest("DELETE", `http://127.0.0.1:${recPort}/api/documents/${repairedDocId}`);

    if (recProcess) {
      recProcess.kill();
      recProcess = null;
    }
    await new Promise((r) => setTimeout(r, 400));
  }, 45000);
});
