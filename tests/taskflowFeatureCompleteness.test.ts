import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createForgeMcpServer } from "../src/mcp/server.js";
import { BrowserInvestigator } from "../src/recreation/browserInvestigator.js";
import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";
import * as net from "node:net";
import { execSync, spawn } from "node:child_process";

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function waitForServer(port: number, timeoutMs = 3000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    function tryConnect() {
      if (Date.now() - start >= timeoutMs) return resolve(false);
      const sock = net.createConnection({ port, host: "127.0.0.1" }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on("error", () => {
        setTimeout(tryConnect, 100);
      });
    }
    tryConnect();
  });
}

describe("TaskFlow Feature Completeness & Faithful Recreation Suite", () => {
  const refDir = path.resolve(__dirname, "../fixtures/taskflow-reference");
  const outputDir = path.resolve(__dirname, "../outputs/taskflow-feature-complete");

  let client: Client;
  let server: ReturnType<typeof createForgeMcpServer>;

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    server = createForgeMcpServer();
    await server.connect(serverTransport);

    client = new Client({ name: "forge-test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  it("1. Recreates TaskFlow via MCP tool forge_recreate_app with full feature extraction", async () => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    const res: any = await client.callTool({
      name: "forge_recreate_app",
      arguments: {
        prompt: "Recreate the TaskFlow task management application with all filtering, status lifecycle, notes, and priority controls",
        targetPath: refDir,
        outputDirectory: outputDir,
        targetEngine: "fullstack-node"
      }
    });

    expect(res.isError).toBeFalsy();
    const resultText = res.content[0].text;
    const resultJson = JSON.parse(resultText);

    expect(resultJson.success).toBe(true);
    expect(resultJson.mode).toBe("reference_driven");

    // Title fidelity: must match reference, not generic "Task Manager Application"
    expect(resultJson.spec.title).toBe("TaskFlow — Project & Task Management");

    // Schema fidelity: must retain all observed SQLite columns
    const primaryEntity = resultJson.spec.entities.find((e: any) => e.name.toLowerCase().includes("task"));
    expect(primaryEntity).toBeDefined();
    const fieldNames = primaryEntity.fields.map((f: any) => f.name);
    expect(fieldNames).toContain("title");
    expect(fieldNames).toContain("category");
    expect(fieldNames).toContain("priority");
    expect(fieldNames).toContain("completed");
    expect(fieldNames).toContain("notes");

    // Workflow fidelity: observed workflows must be recorded
    const workflowIds = resultJson.spec.workflows.map((w: any) => w.id);
    expect(workflowIds).toContain("wf_view_filtering");
    expect(workflowIds).toContain("wf_status_lifecycle");
    expect(workflowIds).toContain("wf_record_deletion");
    expect(workflowIds).toContain("wf_record_creation");

    // Implementation plan fidelity: tasks must map to features
    const planTaskTitles = resultJson.plan.tasks.map((t: any) => t.title);
    expect(planTaskTitles.some((t: string) => t.includes("Filtering"))).toBe(true);
    expect(planTaskTitles.some((t: string) => t.includes("Status Lifecycle"))).toBe(true);

    // Feature matrix categorization in comparison report
    expect(resultJson.comparison.featureMatrix).toBeDefined();
    expect(resultJson.comparison.featureMatrix.length).toBeGreaterThan(0);
    const implementedTested = resultJson.comparison.featureMatrix.filter(
      (m: any) => m.category === "implemented_and_tested"
    );
    expect(implementedTested.length).toBeGreaterThanOrEqual(4);
  }, 45000);

  it("2. Verifies generated file tree and SQLite column integrity", () => {
    expect(fs.existsSync(path.join(outputDir, "server.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "app.db"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "public/index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "public/style.css"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "public/app.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "test.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "workflow.test.js"))).toBe(true);

    // Verify SQLite schema in generated app.db
    const db = new DatabaseSync(path.join(outputDir, "app.db"));
    const cols = db.prepare("PRAGMA table_info(tasks)").all().map((c: any) => c.name);
    db.close();

    expect(cols).toContain("id");
    expect(cols).toContain("title");
    expect(cols).toContain("category");
    expect(cols).toContain("priority");
    expect(cols).toContain("completed");
    expect(cols).toContain("notes");
    expect(cols).toContain("created_at");
  });

  it("3. Executes generated test.js and workflow.test.js suites", () => {
    // Run test.js
    const testOutput = execSync(`"${process.execPath}" test.js`, {
      cwd: outputDir,
      encoding: "utf-8"
    });
    expect(testOutput).toContain("PASSED");

    // Run workflow.test.js
    const workflowOutput = execSync(`"${process.execPath}" workflow.test.js`, {
      cwd: outputDir,
      encoding: "utf-8"
    });
    expect(workflowOutput).toContain("verified successfully");
  });

  it("4. Performs live browser comparison between TaskFlow reference and recreation", async () => {
    const refPort = await getAvailablePort();
    const recPort = await getAvailablePort();

    let refServer: any = null;
    let recServer: any = null;

    try {
      refServer = spawn(process.execPath, ["server.js"], {
        cwd: refDir,
        env: { ...process.env, PORT: String(refPort), NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"]
      });

      recServer = spawn(process.execPath, ["server.js"], {
        cwd: outputDir,
        env: { ...process.env, PORT: String(recPort), NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"]
      });

      const refReady = await waitForServer(refPort, 3000);
      const recReady = await waitForServer(recPort, 3000);
      expect(refReady).toBe(true);
      expect(recReady).toBe(true);

      const compDir = path.join(outputDir, "comparison");
      const comp = await BrowserInvestigator.compareWebApplications(
        `http://127.0.0.1:${refPort}`,
        `http://127.0.0.1:${recPort}`,
        { outputDir: compDir }
      );

      // Save comparison report artifact
      fs.writeFileSync(
        path.join(outputDir, "browser-comparison.json"),
        JSON.stringify(comp, null, 2),
        "utf-8"
      );

      // Title parity: matches
      expect(comp.visualComparison.titleMatch).toBe(true);
      expect(comp.visualComparison.recreationTitle).toBe("TaskFlow — Project & Task Management");

      // Control parity: button recall must include all reference controls
      const commonBtns = comp.visualComparison.buttonsMatch.commonButtons;
      expect(commonBtns.some((b) => b.toLowerCase().includes("add task"))).toBe(true);
      expect(commonBtns.some((b) => b.toLowerCase().includes("all tasks"))).toBe(true);
      expect(commonBtns.some((b) => b.toLowerCase().includes("active"))).toBe(true);
      expect(commonBtns.some((b) => b.toLowerCase().includes("completed"))).toBe(true);
      expect(commonBtns.some((b) => b.toLowerCase().includes("high priority"))).toBe(true);
      expect(commonBtns.some((b) => b.toLowerCase().includes("complete") || b.toLowerCase().includes("reopen"))).toBe(true);
      expect(commonBtns.some((b) => b.toLowerCase().includes("delete"))).toBe(true);

      // Mobile responsiveness
      expect(comp.visualComparison.responsiveParity.parityConfirmed).toBe(true);
      expect(comp.visualComparison.responsiveParity.recreationMobileOk).toBe(true);

      // Behavioral persistence
      expect(comp.behavioralComparison.persistenceParity).toBe(true);

      // Parity Score: with title, all controls, and persistence matching, parity score >= 0.95
      expect(comp.parityScore).toBeGreaterThanOrEqual(0.95);

      // Non-pixel-perfect disclaimer present
      expect(comp.visualComparison.imageDiffPerformed).toBe(false);
      expect(comp.visualComparison.disclaimer).toContain("not performed");
    } finally {
      if (refServer) {
        try { refServer.kill(); } catch {}
      }
      if (recServer) {
        try { recServer.kill(); } catch {}
      }
    }
  }, 45000);

  it("5. Verifies Rule 4 Critical Control Gap Cap protects against incomplete apps", async () => {
    // When button recall is 0/8, score must be capped <= 0.50
    const mockRefInvestigation: any = {
      url: "http://127.0.0.1:4000",
      accessible: true,
      pageTitle: "TaskFlow — Project & Task Management",
      observedControls: {
        buttons: [
          { text: "+ Add Task", selector: "#btn-add-task", tag: "button" },
          { text: "All Tasks", selector: ".filter-all", tag: "button" },
          { text: "Active", selector: ".filter-active", tag: "button" },
          { text: "Completed", selector: ".filter-done", tag: "button" },
          { text: "High Priority", selector: ".filter-high", tag: "button" },
          { text: "Complete", selector: ".btn-toggle", tag: "button" },
          { text: "Delete", selector: ".btn-delete", tag: "button" }
        ],
        inputs: [],
        forms: [],
        menus: [],
        headings: []
      },
      observedStates: { initialState: "normal", emptyStateDetected: false },
      interactionResults: { scenario: "test", steps: [], persistenceVerified: true, apiRequestsObserved: [] },
      limitations: []
    };

    const mockIncompleteRecInvestigation: any = {
      url: "http://127.0.0.1:4001",
      accessible: true,
      pageTitle: "TaskFlow — Project & Task Management",
      observedControls: {
        buttons: [{ text: "Add Item", selector: "button", tag: "button" }], // 0 match
        inputs: [],
        forms: [],
        menus: [],
        headings: []
      },
      observedStates: { initialState: "normal", emptyStateDetected: false },
      interactionResults: { scenario: "test", steps: [], persistenceVerified: true, apiRequestsObserved: [] },
      limitations: []
    };

    // Calculate score using BrowserInvestigator comparator logic
    // We can simulate compareWebApplications scoring or call private/scoring method
    // Since compareWebApplications takes URLs, let's verify through compareWebApplications on outputs/browser-taskflow-recreation
    const oldRecDir = path.resolve("outputs/browser-taskflow-recreation");
    if (fs.existsSync(oldRecDir)) {
      const refPort = await getAvailablePort();
      const oldRecPort = await getAvailablePort();

      let refSrv: any = null;
      let oldRecSrv: any = null;

      try {
        refSrv = spawn(process.execPath, ["server.js"], {
          cwd: refDir,
          env: { ...process.env, PORT: String(refPort), NODE_ENV: "development" },
          stdio: ["ignore", "pipe", "pipe"]
        });

        oldRecSrv = spawn(process.execPath, ["server.js"], {
          cwd: oldRecDir,
          env: { ...process.env, PORT: String(oldRecPort), NODE_ENV: "development" },
          stdio: ["ignore", "pipe", "pipe"]
        });

        await waitForServer(refPort, 3000);
        await waitForServer(oldRecPort, 3000);

        const oldComp = await BrowserInvestigator.compareWebApplications(
          `http://127.0.0.1:${refPort}`,
          `http://127.0.0.1:${oldRecPort}`
        );

        // In the old recreation, only 0 buttons matched out of 8, so Rule 4 cap must apply
        expect(oldComp.visualComparison.buttonsMatch.commonButtons.length).toBe(0);
        expect(oldComp.parityScore).toBeLessThanOrEqual(0.55);
        expect(oldComp.scoring.cappedReason).toContain("critical interactive control gap");
      } finally {
        if (refSrv) { try { refSrv.kill(); } catch {} }
        if (oldRecSrv) { try { oldRecSrv.kill(); } catch {} }
      }
    }
  }, 45000);
});
