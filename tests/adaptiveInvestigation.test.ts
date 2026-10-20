import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import * as net from "node:net";
import * as path from "node:path";
import { RecreationInvestigator } from "../src/recreation/investigator.js";
import { RecreationOrchestrator } from "../src/recreation/orchestrator.js";

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

describe("Adaptive REA Investigation Suite", () => {
  let mockServer: http.Server;
  let mockServerPort: number;
  let mockServerUrl: string;

  beforeAll(async () => {
    mockServerPort = await getAvailablePort();
    mockServerUrl = `http://127.0.0.1:${mockServerPort}`;

    // Local deterministic HTTP server simulating an accessible web application
    mockServer = http.createServer((req, res) => {
      if (req.url === "/api/tasks") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([{ id: 1, title: "Initial Task", status: "open" }]));
        return;
      }

      // Root HTML page with interactive form, controls, responsive meta, and script fetch
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskMaster Pro - Team Management</title>
</head>
<body>
  <header>
    <h1>TaskMaster Workspace</h1>
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/settings">Settings</a>
    </nav>
  </header>
  <main>
    <h2>Create New Assignment</h2>
    <form action="/api/tasks" method="POST">
      <input type="text" name="title" placeholder="Task Title" required>
      <textarea name="description" placeholder="Task details"></textarea>
      <input type="number" name="priority" min="1" max="5">
      <button type="submit">Create Task</button>
    </form>
    <div id="status-badge" class="autosave">Saved</div>
  </main>
  <script>
    fetch('/api/tasks/metrics');
  </script>
</body>
</html>`;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(mockServerPort, "127.0.0.1", () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });
  });

  it("1. Classifies target correctly across URLs, source directories, databases, packages, and greenfield", () => {
    const investigator = new RecreationInvestigator();

    const urlClass = investigator.classifyTarget("https://example.com/app");
    expect(urlClass.targetType).toBe("web_url");
    expect(urlClass.classification.category).toBe("web_url");
    expect(urlClass.classification.accessible).toBe(true);

    const dirClass = investigator.classifyTarget(path.resolve("."));
    expect(dirClass.targetType).toBe("source_code");
    expect(dirClass.classification.category).toBe("source_repository");
    expect(dirClass.classification.accessible).toBe(true);

    const missingClass = investigator.classifyTarget("D:/inaccessible-non-existent-dir-12345");
    expect(missingClass.targetType).toBe("unknown");
    expect(missingClass.classification.category).toBe("inaccessible");
    expect(missingClass.classification.accessible).toBe(false);

    const greenfieldClass = investigator.classifyTarget(undefined);
    expect(greenfieldClass.targetType).toBe("unknown");
    expect(greenfieldClass.classification.category).toBe("greenfield");
    expect(greenfieldClass.classification.accessible).toBe(true);
  });

  it("2. Greenfield request skips unnecessary reference investigation and REA tool calls", async () => {
    const investigator = new RecreationInvestigator();
    const prompt = "Build a new fitness habit tracking application with daily streaks and charts";
    const result = await investigator.investigate(prompt);

    expect(result.mode).toBe("greenfield");
    expect(result.targetClassification?.category).toBe("greenfield");
    expect(result.discoveredTools).toEqual([]);
    expect(result.executedTools).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.limitations.some((l) => l.includes("Greenfield application"))).toBe(true);
    expect(result.coverageAssessment.confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it("3. URL-based investigation discovers tools, inspects DOM, routes, controls, and responsive layout", async () => {
    const investigator = new RecreationInvestigator();
    const prompt = "Recreate TaskMaster Pro application from running website";
    const result = await investigator.investigate(prompt, mockServerUrl);

    expect(result.mode).toBe("reference_driven");
    expect(result.targetType).toBe("web_url");
    expect(result.targetClassification?.accessible).toBe(true);

    // Dynamic REA tool discovery occurred
    expect(result.discoveredTools?.length).toBeGreaterThan(0);
    expect(result.discoveredTools).toContain("inspect_web_page");
    expect(result.executedTools).toContain("inspect_web_page");

    // Observed capabilities extracted from live HTML
    expect(result.observedCapabilities).toContain("web-application");
    expect(result.observedCapabilities).toContain("responsive-layout");
    expect(result.observedCapabilities).toContain("form-submission");
    expect(result.observedCapabilities).toContain("rest-api");
    expect(result.observedCapabilities).toContain("autosave");

    // Inferred entities with strict observed provenance on form inputs
    const entity = result.inferredEntities.find((e) => e.fields.some((f) => f.name === "title"));
    expect(entity).toBeDefined();
    const titleField = entity!.fields.find((f) => f.name === "title");
    expect(titleField?.provenance).toBe("observed");
    const descField = entity!.fields.find((f) => f.name === "description");
    expect(descField?.provenance).toBe("observed");

    // Inferred operations from observed form actions and script fetch endpoints
    const submitOp = result.inferredOperations.find((op) => op.name.includes("submit"));
    expect(submitOp).toBeDefined();
    expect(submitOp?.provenance).toBe("observed");

    // Inferred workflows from observed form
    const formWf = result.inferredWorkflows.find((wf) => wf.id.includes("wf_form_"));
    expect(formWf).toBeDefined();
    expect(formWf?.provenance).toBe("observed");

    // Evidence and limitations distinguish observed UI from inferred backend
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.limitations.some((l) => l.toLowerCase().includes("headless browser"))).toBe(true);
    expect(result.limitations.some((l) => l.includes("Backend database structure inferred"))).toBe(true);
    expect(result.coverageAssessment.confidenceScore).toBeGreaterThanOrEqual(0.85);
  });

  it("4. Inaccessible URL targets report connection failure and 0 confidence without fabricating data", async () => {
    const investigator = new RecreationInvestigator();
    // Using a guaranteed closed port to ensure connection refusal
    const closedPort = await getAvailablePort();
    const unreachableUrl = `http://127.0.0.1:${closedPort}/offline`;

    const result = await investigator.investigate("Recreate offline app", unreachableUrl);

    expect(result.targetType).toBe("web_url");
    expect(result.targetClassification?.accessible).toBe(false);
    expect(result.coverageAssessment.confidenceScore).toBe(0.0);
    expect(result.coverageAssessment.unknownWorkflows).toBe(1);
    expect(result.unknowns.some((u) => u.includes("could not be accessed"))).toBe(true);
    expect(result.limitations.some((l) => l.includes("connection failed"))).toBe(true);
    expect(result.evidence).toEqual([]);
  });

  it("5. Local source directory investigation performs tool discovery and gap discovery for SQLite", async () => {
    const investigator = new RecreationInvestigator();
    const refPath = path.resolve("fixtures/reference-document-app");

    const result = await investigator.investigate(
      "Recreate Document Studio application with rich-text editing and autosave",
      refPath
    );

    expect(result.targetType).toBe("source_code");
    expect(result.targetClassification?.accessible).toBe(true);

    // Tool discovery discovered artifact inspection
    expect(result.discoveredTools).toContain("inspect_artifact");
    expect(result.executedTools).toContain("inspect_artifact");

    // Gap discovery: finding reference.db triggered dynamic discovery and execution of inspect_sqlite_database
    expect(result.discoveredTools).toContain("inspect_sqlite_database");
    expect(result.executedTools).toContain("inspect_sqlite_database");

    // Real REA provider execution captured
    const sqliteEvidence = result.evidence.find((e) => e.kind === "schema" && e.sourcePath.endsWith(".db"));
    expect(sqliteEvidence).toBeDefined();
    expect(sqliteEvidence?.findings.type).toBe("sqlite");
    expect(sqliteEvidence?.findings.sha256).toBeDefined();

    expect(result.observedCapabilities).toContain("persistent-sqlite-storage");
    expect(result.observedCapabilities).toContain("document-create");
    expect(result.observedCapabilities).toContain("document-export");
  });

  it("6. Missing specialist providers (e.g. Android apktool) are recorded honestly in limitations and blocked providers", async () => {
    const investigator = new RecreationInvestigator();
    const result = await investigator.investigate(
      "Recreate mobile application",
      "mobile-client-sample.apk"
    );

    expect(result.targetType).toBe("android_package");
    expect(result.discoveredTools).toContain("inspect_android_package");
    expect(result.executedTools).toContain("inspect_android_package");
    expect(result.coverageAssessment.blockedByMissingProviders).toContain("apktool");
    expect(result.coverageAssessment.confidenceScore).toBeLessThan(0.5);
    expect(result.limitations.some((l) => l.includes("apktool/dex2jar"))).toBe(true);
  });

  it("7. Investigation results flow seamlessly through specification and implementation plan", async () => {
    const orchestrator = new RecreationOrchestrator();
    const outDir = path.resolve("outputs/test-adaptive-plan-flow");

    const result = await orchestrator.recreate({
      prompt: "Recreate TaskMaster Pro from live web reference",
      targetPath: mockServerUrl,
      outputDirectory: outDir,
      planOnly: true
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe("reference_driven");

    // Observed entities from web investigation merged into spec
    expect(result.spec.entities.some((e) => e.fields.some((f) => f.name === "title"))).toBe(true);

    // Observed workflows merged into spec
    expect(result.spec.workflows?.some((w) => w.id.includes("wf_form_"))).toBe(true);

    // Investigation limitations passed into plan
    expect(result.plan.limitations.some((l) => l.toLowerCase().includes("headless browser"))).toBe(true);
    expect(result.plan.selectedEngine).toBe("fullstack-node");
  });
});
