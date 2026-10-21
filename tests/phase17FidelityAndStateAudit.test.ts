import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import http from "node:http";
import { BrowserInvestigator } from "../src/recreation/browserInvestigator.js";
import { UniversalNodeEngine } from "../src/engines/universalNodeEngine.js";
import { RecreationComparator } from "../src/recreation/comparator.js";
import { ForgeVerifier } from "../src/verifier/verifier.js";
import { ForgeSpec } from "../src/spec/schema.js";
import { ReaInvestigationBridge } from "../src/investigation/reaBridge.js";
import { RecreationInvestigator } from "../src/recreation/investigator.js";

function writeGeneratedFiles(result: { files: Array<{ relativePath: string; content: string }> }, outDir: string) {
  for (const f of result.files) {
    const fullP = path.join(outDir, f.relativePath);
    fs.mkdirSync(path.dirname(fullP), { recursive: true });
    fs.writeFileSync(fullP, f.content, "utf-8");
  }
}

describe("Phase 17: Reference Fidelity, State Parity & Generalization Audit Suite", () => {
  const testOutDir = path.resolve("temp_phase17_audit_apps");

  beforeEach(() => {
    if (!fs.existsSync(testOutDir)) {
      fs.mkdirSync(testOutDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutDir)) {
      try {
        fs.rmSync(testOutDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // Test 1: Content-only pages remain free of irrelevant task controls
  it("Test 1: Content-only pages remain free of irrelevant task controls and preserve observed presentation", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!doctype html>
        <html>
        <head><title>Example Content Portal</title></head>
        <body>
          <header>
            <h1>Example Content Portal</h1>
            <p>A reference documentation and informational resource.</p>
          </header>
          <main>
            <h2>Official Guidelines</h2>
            <p>Standards and specifications for web applications.</p>
            <a href="https://example.org/docs">Learn More</a>
          </main>
        </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as any).port;
    const url = `http://127.0.0.1:${port}`;

    try {
      const bridge = new ReaInvestigationBridge();
      const investigator = new RecreationInvestigator(bridge);
      const investigation = await investigator.investigateWebUrl(url, "Recreate this content website", bridge.probeReaStatus());

      expect(investigation.inferredEntities.some((e) => e.name === "Task")).toBe(false);
      expect(investigation.inferredEntities.some((e) => e.name === "ContentPage")).toBe(true);

      const spec: ForgeSpec = {
        name: "example-content-portal",
        title: "Example Content Portal",
        description: "Recreation of example content portal",
        entities: investigation.inferredEntities,
        operations: [
          { name: "getContent", type: "query", entities: ["ContentPage"], provenance: "observed" },
          { name: "updateContent", type: "action", entities: ["ContentPage"], provenance: "observed" }
        ],
        routes: [{ name: "Home", path: "/", component: "ContentView", isProtected: false, provenance: "observed" }],
        workflows: investigation.inferredWorkflows,
        features: ["Structured Content Presentation", "Responsive Layout"],
        targetStack: "node-express-sqlite",
        capabilities: ["web-application", "content-presentation", "responsive-layout"],
        metadata: {
          domain: "content",
          observedHeadings: ["Example Content Portal", "Official Guidelines"],
          observedParagraphs: ["A reference documentation and informational resource.", "Standards and specifications for web applications."],
          observedLinks: [{ text: "Learn More", href: "https://example.org/docs" }]
        }
      };

      const outAppDir = path.join(testOutDir, "content_app");
      const engine = new UniversalNodeEngine();
      const genRes = await engine.generate(spec, outAppDir);
      writeGeneratedFiles(genRes, outAppDir);

      const htmlContent = fs.readFileSync(path.join(outAppDir, "public", "index.html"), "utf-8");
      expect(htmlContent).not.toMatch(/Add Task/i);
      expect(htmlContent).not.toMatch(/data-action="add-task"/i);
      expect(htmlContent).not.toMatch(/priority/i);
      expect(htmlContent).toContain("Example Content Portal");
      expect(htmlContent).toContain("Official Guidelines");
      expect(htmlContent).toContain("Learn More");

      // Verify with RecreationComparator
      const comparator = new RecreationComparator();
      const compReport = await comparator.compare(outAppDir, spec, investigation, {
        specName: spec.name,
        targetStack: "node-express-sqlite",
        engine: "UniversalNodeEngine",
        phases: []
      });


      expect(compReport.overallStatus).toBe("pass");
      expect(compReport.applicationQuality.status).toBe("pass");
      expect(compReport.referenceFidelity?.status).toBe("pass");
      expect(compReport.referenceFidelity?.fabricatedControlsPenalized).toBe(false);
      expect(compReport.referenceFidelity?.fidelityScore).toBeGreaterThanOrEqual(0.95);
    } finally {
      server.close();
    }
  });

  // Test 2: API documentation retains observable operations, links, and expandable buttons without fabricating task CRUD
  it("Test 2: API documentation retains observable operations, links, and expandable buttons without fabricating task CRUD", async () => {
    const endpoints = [
      "/ip", "/user-agent", "/headers", "/get", "/post",
      "/put", "/delete", "/patch", "/status/200", "/response-headers", "/api/endpoints"
    ];

    const server = http.createServer((req, res) => {
      if (req.url === "/api/endpoints") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ endpoints }));
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      const opblocks = endpoints.map((ep) => `
        <div class="opblock opblock-get">
          <button class="opblock-summary-control">Expand operation</button>
          <span class="opblock-summary-path">${ep}</span>
        </div>
      `).join("\n");

      res.end(`
        <!doctype html>
        <html>
        <head><title>Mock Service Explorer</title></head>
        <body>
          <header>
            <h1>Mock Service Explorer</h1>
            <h2>HTTP Request & Response Service Endpoints</h2>
            <p>Swagger documentation for client testing.</p>
            <a href="https://example.org/spec.json">OpenAPI Specification</a>
            <a href="https://example.org/terms">Terms of Service</a>
          </header>
          <div class="swagger-ui">
            ${opblocks}
          </div>
        </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as any).port;
    const url = `http://127.0.0.1:${port}`;

    try {
      const bridge = new ReaInvestigationBridge();
      const investigator = new RecreationInvestigator(bridge);
      const investigation = await investigator.investigateWebUrl(url, "Recreate this API documentation explorer", bridge.probeReaStatus());

      expect(investigation.inferredEntities.some((e) => e.name === "ApiEndpoint")).toBe(true);
      expect(investigation.observedCapabilities).toContain("api-documentation");

      const spec: ForgeSpec = {
        name: "mock-service-explorer",
        title: "Mock Service Explorer",
        description: "Recreation of mock API documentation explorer",
        entities: investigation.inferredEntities,
        operations: [
          { name: "getEndpoints", type: "query", entities: ["ApiEndpoint"], provenance: "observed" },
          { name: "probeEndpoint", type: "action", entities: ["ApiEndpoint"], provenance: "observed" }
        ],
        routes: [{ name: "Docs", path: "/", component: "ApiDocsView", isProtected: false, provenance: "observed" }],
        workflows: investigation.inferredWorkflows,
        features: ["Interactive API Explorer", "Endpoint Probing", "Responsive Layout"],
        targetStack: "node-express-sqlite",
        capabilities: ["web-application", "api-documentation", "responsive-layout"],
        metadata: {
          domain: "api-docs",
          observedHeadings: ["Mock Service Explorer", "HTTP Request & Response Service Endpoints"],
          observedParagraphs: ["Swagger documentation for client testing."],
          observedLinks: [
            { text: "OpenAPI Specification", href: "https://example.org/spec.json" },
            { text: "Terms of Service", href: "https://example.org/terms" }
          ],
          observedButtonLabels: ["Expand operation"]
        }
      };

      const outAppDir = path.join(testOutDir, "api_docs_app");
      const engine = new UniversalNodeEngine();
      const genRes = await engine.generate(spec, outAppDir);
      writeGeneratedFiles(genRes, outAppDir);

      const htmlContent = fs.readFileSync(path.join(outAppDir, "public", "index.html"), "utf-8");
      expect(htmlContent).toContain("Mock Service Explorer");
      expect(htmlContent).toContain("Expand operation");
      expect(htmlContent).toContain("OpenAPI Specification");
      expect(htmlContent).not.toMatch(/Add Task/i);

      // Verify with RecreationComparator
      const comparator = new RecreationComparator();
      const compReport = await comparator.compare(outAppDir, spec, investigation, {
        specName: spec.name,
        targetStack: "node-express-sqlite",
        engine: "UniversalNodeEngine",
        phases: []
      });


      expect(compReport.overallStatus).toBe("pass");
      expect(compReport.applicationQuality.status).toBe("pass");
      expect(compReport.referenceFidelity?.status).toBe("pass");
      expect(compReport.referenceFidelity?.fidelityScore).toBeGreaterThanOrEqual(0.95);
      expect(compReport.evaluations.some((e) => e.id === "feat_browser_interactive_persistence" && e.status === "pass")).toBe(true);
    } finally {
      server.close();
    }
  });

  // Test 3: Task applications reproduce state-dependent controls across lifecycle
  it("Test 3: Task applications reproduce state-dependent controls across empty, active, completed, and clear states", async () => {
    const spec: ForgeSpec = {
      name: "minimalist-todos",
      title: "todos",
      description: "Minimalist TodoMVC task application",
      entities: [
        {
          name: "Task",
          provenance: "observed",
          fields: [
            { name: "id", type: "string", isId: true },
            { name: "title", type: "string", isRequired: true },
            { name: "completed", type: "boolean", defaultValue: false }
          ]
        }
      ],
      operations: [
        { name: "getTasks", type: "query", entities: ["Task"], provenance: "observed" },
        { name: "createTask", type: "action", entities: ["Task"], provenance: "observed" },
        { name: "toggleTask", type: "action", entities: ["Task"], provenance: "observed" },
        { name: "clearCompleted", type: "action", entities: ["Task"], provenance: "observed" }
      ],
      routes: [{ name: "Home", path: "/", component: "TodoView", isProtected: false, provenance: "observed" }],
      workflows: [
        {
          id: "wf_todo_lifecycle",
          name: "Todo Lifecycle Workflow",
          description: "Create via Enter, toggle complete, filter active/completed, clear completed",
          trigger: "User interaction",
          steps: [],
          acceptanceCriteria: ["Tasks persist across reload", "Completed items clear cleanly"],
          provenance: "observed"
        }
      ],
      features: ["Minimalist Task Management", "State Filtering", "Clear Completed"],
      targetStack: "node-express-sqlite",
      capabilities: ["web-application", "browser-verified-ui", "responsive-layout"],
      metadata: {
        domain: "task-management",
        observedHeadings: ["todos"],
        observedControls: {
          inputs: ["What needs to be done?"],
          buttons: ["All", "Active", "Completed", "Clear completed"]
        }
      }
    };

    const outAppDir = path.join(testOutDir, "minimalist_todos_app");
    const engine = new UniversalNodeEngine();
    const genRes = await engine.generate(spec, outAppDir);
    writeGeneratedFiles(genRes, outAppDir);

    const htmlContent = fs.readFileSync(path.join(outAppDir, "public", "index.html"), "utf-8");
    const serverJs = fs.readFileSync(path.join(outAppDir, "server.js"), "utf-8");

    // 1. Clean minimalist layout: <h1>todos</h1>, new-todo input with enter key
    expect(htmlContent).toContain("todos");
    expect(htmlContent).toContain("new-todo");
    expect(htmlContent).not.toMatch(/Add Task/i);
    expect(htmlContent).not.toMatch(/high priority/i);
    expect(htmlContent).toContain("clear-completed");

    // 2. Server provides clear-completed endpoints
    expect(serverJs).toMatch(/\/api\/tasks\/clear-completed/);
    expect(serverJs).toMatch(/\/api\/tasks\/completed/);

    // 3. Verifier verifies compilation and execution
    const verifier = new ForgeVerifier();
    const verResult = await verifier.verify(outAppDir, spec);
    expect(verResult.overallPassed).toBe(true);
  });

  // Test 4: Inaccessible/missing reference evidence is reported honestly
  it("Test 4: Inaccessible/missing reference evidence is reported honestly without claiming live inspection", async () => {
    const unreachableUrl = "http://127.0.0.1:59998/offline-endpoint";

    const bridge = new ReaInvestigationBridge();
    const investigator = new RecreationInvestigator(bridge);
    const investigation = await investigator.investigateWebUrl(unreachableUrl, "Recreate offline website", bridge.probeReaStatus());

    expect(investigation.targetClassification?.accessible).toBe(false);
    expect(investigation.targetClassification?.reason).toBeDefined();
    expect(investigation.limitations.length).toBeGreaterThan(0);
    expect(investigation.limitations[0]).toContain("Cannot inspect live website");
    expect(investigation.evidence.length).toBe(0);

    // RecreationComparator evaluates unreachable target with 'unavailable' status
    const spec: ForgeSpec = {
      name: "offline-recreation",
      title: "Offline Recreation",
      description: "Fallback offline recreation",
      entities: investigation.inferredEntities,
      operations: [],
      routes: [{ name: "Home", path: "/", component: "ContentView", isProtected: false }],
      workflows: [],
      features: ["Offline Fallback"],
      targetStack: "node-express-sqlite",
      capabilities: ["web-application"]
    };

    const outAppDir = path.join(testOutDir, "offline_app");
    const engine = new UniversalNodeEngine();
    const genRes = await engine.generate(spec, outAppDir);
    writeGeneratedFiles(genRes, outAppDir);

    const comparator = new RecreationComparator();
    const compReport = await comparator.compare(outAppDir, spec, investigation, {
      specName: spec.name,
      targetStack: "node-express-sqlite",
      engine: "UniversalNodeEngine",
      phases: []
    });

    const parityEval = compReport.evaluations.find((e) => e.id === "feat_browser_parity");
    expect(parityEval).toBeDefined();
    expect(parityEval?.status).toBe("unavailable");
    expect(parityEval?.evidence).toContain("Reference target was unreachable");
    expect(parityEval?.details).toContain("Comparative browser parity evaluation skipped");
  });

  // Test 5: User-requested additions are distinguished from reference-observed functionality
  it("Test 5: User-requested additions are distinguished from reference-observed functionality in Feature Matrix", async () => {
    const spec: ForgeSpec = {
      name: "hybrid-reference-app",
      title: "Hybrid Reference Application",
      description: "Observed content plus user requested authentication",
      entities: [
        {
          name: "ContentPage",
          provenance: "observed",
          fields: [
            { name: "id", type: "string", isId: true, provenance: "observed" },
            { name: "title", type: "string", provenance: "observed" }
          ]
        },
        {
          name: "UserAccount",
          provenance: "user_requested",
          fields: [
            { name: "username", type: "string", provenance: "user_requested" },
            { name: "role", type: "string", provenance: "user_requested" }
          ]
        }
      ],
      operations: [
        { name: "getContent", type: "query", entities: ["ContentPage"], provenance: "observed" },
        { name: "authenticateUser", type: "action", entities: ["UserAccount"], provenance: "user_requested" }
      ],
      routes: [
        { name: "Home", path: "/", component: "ContentView", isProtected: false, provenance: "observed" },
        { name: "Login", path: "/login", component: "LoginView", isProtected: false, provenance: "user_requested" }
      ],
      workflows: [
        {
          id: "wf_content_view",
          name: "Structured Content & Presentation Model Retrieval",
          description: "Read-only content retrieval",
          trigger: "Page Load",
          steps: [],
          acceptanceCriteria: ["Content renders cleanly"],
          provenance: "observed"
        },
        {
          id: "wf_user_auth",
          name: "User Authentication & Session Management",
          description: "User login and session creation",
          trigger: "User Submit",
          steps: [],
          acceptanceCriteria: ["User authenticates with token"],
          provenance: "user_requested"
        }
      ],
      features: ["Content Presentation", "User Authentication"],
      targetStack: "node-express-sqlite",
      capabilities: ["web-application", "content-presentation", "responsive-layout"],
      metadata: {
        domain: "content"
      }
    };

    const outAppDir = path.join(testOutDir, "hybrid_app");
    const engine = new UniversalNodeEngine();
    const genRes = await engine.generate(spec, outAppDir);
    writeGeneratedFiles(genRes, outAppDir);

    const comparator = new RecreationComparator();
    const compReport = await comparator.compare(outAppDir, spec, {
      targetPath: undefined,
      mode: "reference_recreation",
      limitations: [],
      coverageAssessment: { blockedByMissingProviders: [] }
    }, {
      specName: spec.name,
      targetStack: "node-express-sqlite",
      engine: "UniversalNodeEngine",
      phases: []
    });

    expect(compReport.featureMatrix).toBeDefined();
    const observedEntries = compReport.featureMatrix!.filter((f) => f.provenance === "observed");
    const userRequestedEntries = compReport.featureMatrix!.filter((f) => f.provenance === "user_requested");

    expect(observedEntries.length).toBeGreaterThan(0);
    expect(userRequestedEntries.length).toBeGreaterThan(0);

    const authEntry = userRequestedEntries.find((f) => f.name === "User Authentication & Session Management");
    expect(authEntry).toBeDefined();
    expect(authEntry?.category).toBe("additional");
    expect(authEntry?.provenance).toBe("user_requested");
  });

  // Test 6: Unfamiliar API documentation sites are classified using observable structure without brand names
  it("Test 6: Unfamiliar API documentation sites are classified using observable structure without brand names", async () => {
    const endpoints = ["/v1/auth", "/v1/metrics", "/v1/deploy", "/v1/health"];
    const server = http.createServer((req, res) => {
      if (req.url === "/api/endpoints") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ endpoints }));
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      const opblocks = endpoints.map((ep) => `
        <div class="opblock">
          <button class="opblock-summary-control">Expand operation</button>
          <span class="opblock-summary-path">${ep}</span>
        </div>
      `).join("\n");

      res.end(`
        <!doctype html>
        <html>
        <head><title>Nexus Cloud Gateway API</title></head>
        <body>
          <header>
            <h1>Nexus Cloud Gateway API</h1>
            <h2>RESTful Management Interface</h2>
            <p>Interactive service explorer and documentation for cloud infrastructure.</p>
            <a href="https://nexus.cloud/openapi.json">OpenAPI Specification</a>
          </header>
          <div class="swagger-ui">
            ${opblocks}
          </div>
        </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as any).port;
    const url = `http://127.0.0.1:${port}`;

    try {
      const bridge = new ReaInvestigationBridge();
      const investigator = new RecreationInvestigator(bridge);
      const investigation = await investigator.investigateWebUrl(url, "Recreate this API documentation site", bridge.probeReaStatus());

      // Classified without brand name
      expect(investigation.observedCapabilities).toContain("api-documentation");
      expect(investigation.inferredEntities.some((e) => e.name === "ApiEndpoint")).toBe(true);
      expect(investigation.inferredEntities.some((e) => e.name === "Task")).toBe(false);

      const spec: ForgeSpec = {
        name: "nexus-cloud-api",
        title: "Nexus Cloud Gateway API",
        description: "Recreation of Nexus Cloud Gateway API documentation",
        entities: investigation.inferredEntities,
        operations: [
          { name: "getEndpoints", type: "query", entities: ["ApiEndpoint"], provenance: "observed" },
          { name: "probeEndpoint", type: "action", entities: ["ApiEndpoint"], provenance: "observed" }
        ],
        routes: [{ name: "Docs", path: "/", component: "ApiDocsView", isProtected: false, provenance: "observed" }],
        workflows: investigation.inferredWorkflows,
        features: ["Interactive API Explorer", "Endpoint Probing", "Responsive Layout"],
        targetStack: "node-express-sqlite",
        capabilities: ["web-application", "api-documentation", "responsive-layout"],
        metadata: {
          domain: "api-docs",
          observedHeadings: ["Nexus Cloud Gateway API", "RESTful Management Interface"],
          observedParagraphs: ["Interactive service explorer and documentation for cloud infrastructure."],
          observedLinks: [{ text: "OpenAPI Specification", href: "https://nexus.cloud/openapi.json" }],
          observedButtonLabels: ["Expand operation"],
          observedEndpoints: endpoints.map((ep) => ({ method: "GET", path: ep, description: `Route ${ep}` }))
        }
      };

      const outAppDir = path.join(testOutDir, "nexus_api_app");
      const engine = new UniversalNodeEngine();
      const genRes = await engine.generate(spec, outAppDir);
      writeGeneratedFiles(genRes, outAppDir);

      const htmlContent = fs.readFileSync(path.join(outAppDir, "public", "index.html"), "utf-8");
      expect(htmlContent).toContain("Nexus Cloud Gateway API");
      expect(htmlContent).toContain("Expand operation");
      expect(htmlContent).not.toMatch(/Add Task/i);
      expect(htmlContent).not.toMatch(/httpbin/i);
      expect(htmlContent).not.toMatch(/todomvc/i);

      const comparator = new RecreationComparator();
      const compReport = await comparator.compare(outAppDir, spec, investigation, {
        specName: spec.name,
        targetStack: "node-express-sqlite",
        engine: "UniversalNodeEngine",
        phases: []
      });


      expect(compReport.overallStatus).toBe("pass");
      expect(compReport.referenceFidelity?.fidelityScore).toBeGreaterThanOrEqual(0.95);
    } finally {
      server.close();
    }
  });

  // Test 7: Minimalist task applications work without relying on website names and omit unobserved brand footers
  it("Test 7: Minimalist task applications work without relying on website names and omit unobserved brand footers", async () => {
    const spec: ForgeSpec = {
      name: "focus-checklist",
      title: "Focus Checklist",
      description: "Minimalist task application for daily priorities",
      entities: [
        {
          name: "Task",
          provenance: "observed",
          fields: [
            { name: "id", type: "string", isId: true },
            { name: "title", type: "string", isRequired: true },
            { name: "completed", type: "boolean", defaultValue: false }
          ]
        }
      ],
      operations: [
        { name: "getTasks", type: "query", entities: ["Task"], provenance: "observed" },
        { name: "createTask", type: "action", entities: ["Task"], provenance: "observed" },
        { name: "toggleTask", type: "action", entities: ["Task"], provenance: "observed" },
        { name: "clearCompleted", type: "action", entities: ["Task"], provenance: "observed" }
      ],
      routes: [{ name: "Home", path: "/", component: "TodoView", isProtected: false, provenance: "observed" }],
      workflows: [],
      features: ["Minimalist Task Management", "State Filtering", "Clear Completed"],
      targetStack: "node-express-sqlite",
      capabilities: ["web-application", "minimalist-task-ui", "responsive-layout"],
      metadata: {
        domain: "task-management",
        observedHeadings: ["Focus Checklist"],
        observedButtons: ["Clear completed"]
      }
    };

    const outAppDir = path.join(testOutDir, "focus_checklist_app");
    const engine = new UniversalNodeEngine();
    const genRes = await engine.generate(spec, outAppDir);
    writeGeneratedFiles(genRes, outAppDir);

    const htmlContent = fs.readFileSync(path.join(outAppDir, "public", "index.html"), "utf-8");

    // Must preserve observed heading, not hardcoded "todos"
    expect(htmlContent).toContain("<h1>Focus Checklist</h1>");
    // Must NOT contain hardcoded TodoMVC footer
    expect(htmlContent).not.toMatch(/Part of.*TodoMVC/i);
    expect(htmlContent).not.toContain("https://todomvc.com");
    // Must contain minimalist structure
    expect(htmlContent).toContain("new-todo");
    expect(htmlContent).not.toMatch(/Add Task/i);

    const verifier = new ForgeVerifier();
    const verResult = await verifier.verify(outAppDir, spec);
    expect(verResult.overallPassed).toBe(true);
  });

  // Test 8: TodoMVC footer link is preserved dynamically when observed in reference evidence
  it("Test 8: TodoMVC footer link is preserved dynamically when observed in reference evidence", async () => {
    const spec: ForgeSpec = {
      name: "observed-todomvc",
      title: "todos",
      description: "Recreation of TodoMVC with observed evidence",
      entities: [
        {
          name: "Task",
          provenance: "observed",
          fields: [
            { name: "id", type: "string", isId: true },
            { name: "title", type: "string", isRequired: true },
            { name: "completed", type: "boolean", defaultValue: false }
          ]
        }
      ],
      operations: [
        { name: "getTasks", type: "query", entities: ["Task"], provenance: "observed" },
        { name: "createTask", type: "action", entities: ["Task"], provenance: "observed" }
      ],
      routes: [{ name: "Home", path: "/", component: "TodoView", isProtected: false, provenance: "observed" }],
      workflows: [],
      features: ["Task Management"],
      targetStack: "node-express-sqlite",
      capabilities: ["web-application", "minimalist-task-ui"],
      metadata: {
        domain: "task-management",
        observedHeadings: ["todos"],
        observedButtons: ["Clear completed"],
        observedLinks: [
          { text: "TodoMVC", href: "https://todomvc.com" }
        ]
      }
    };

    const outAppDir = path.join(testOutDir, "observed_todomvc_app");
    const engine = new UniversalNodeEngine();
    const genRes = await engine.generate(spec, outAppDir);
    writeGeneratedFiles(genRes, outAppDir);

    const htmlContent = fs.readFileSync(path.join(outAppDir, "public", "index.html"), "utf-8");

    // Dynamic preservation based on observed links evidence
    expect(htmlContent).toContain("<h1>todos</h1>");
    expect(htmlContent).toMatch(/Part of <a href="https:\/\/todomvc\.com"[^>]*>TodoMVC<\/a>/);
  });
});
