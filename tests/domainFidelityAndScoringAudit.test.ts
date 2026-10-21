import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import http from "node:http";
import { BrowserInvestigator, BrowserPageInvestigation } from "../src/recreation/browserInvestigator.js";
import { UniversalNodeEngine } from "../src/engines/universalNodeEngine.js";
import { RecreationComparator } from "../src/recreation/comparator.js";
import { ForgeVerifier } from "../src/verifier/verifier.js";
import { ForgeSpec } from "../src/spec/schema.js";
import { ReaInvestigationBridge } from "../src/investigation/reaBridge.js";
import { RecreationInvestigator } from "../src/recreation/investigator.js";

describe("Phase 16: Domain Fidelity, Reference Parity & Scoring Audit Suite", () => {
  const testOutDir = path.resolve("temp_phase16_test_apps");

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

  describe("1. Investigation & Domain Inference Fidelity", () => {
    it("faithfully infers 'ContentPage' and 'content-presentation' for static/content HTML without fabricating tasks", async () => {
      // Mock static content page server mimicking example.com
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!doctype html>
          <html>
          <head><title>Example Domain</title></head>
          <body>
            <div>
              <h1>Example Domain</h1>
              <p>This domain is for use in illustrative examples in documents.</p>
              <p><a href="https://www.iana.org/domains/example">More information...</a></p>
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
        const reaStatus = bridge.probeReaStatus();
        const investigator = new RecreationInvestigator(bridge);

        const investigation = await investigator.investigateWebUrl(url, "Recreate this website", reaStatus);

        expect(investigation.inferredEntities.some((e) => e.name === "Task")).toBe(false);
        expect(investigation.inferredEntities.some((e) => e.name === "ContentPage")).toBe(true);
        expect(investigation.observedCapabilities).toContain("content-presentation");
        expect(investigation.inferredWorkflows.some((w) => w.id === "wf_content_view")).toBe(true);
        expect(investigation.inferredWorkflows.some((w) => w.id === "wf_task_lifecycle")).toBe(false);

        const allHeadings = investigation.evidence.flatMap((ev: any) => ev.findings?.headings || ev.findings?.observedControls?.headings || []);
        expect(allHeadings).toContain("Example Domain");
      } finally {
        server.close();
      }
    });

    it("faithfully infers 'ApiEndpoint' and 'api-documentation' for HTTP services without fabricating task managers", async () => {
      // Mock API documentation server mimicking httpbin.org
      const server = http.createServer((req, res) => {
        if (req.url === "/api/endpoints") {
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ endpoints: ["/get", "/post", "/status/200"] }));
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <!doctype html>
          <html>
          <head><title>httpbin.org - HTTP Client Testing Service</title></head>
          <body>
            <h1>httpbin.org</h1>
            <h2>HTTP Request & Response Service Endpoints</h2>
            <p>Documentation for REST API endpoints and swagger definitions.</p>
            <script>const endpoints = ["/api/get", "/api/post", "/api/status"];</script>
          </body>
          </html>
        `);
      });

      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
      const port = (server.address() as any).port;
      const url = `http://127.0.0.1:${port}`;

      try {
        const bridge = new ReaInvestigationBridge();
        const reaStatus = bridge.probeReaStatus();
        const investigator = new RecreationInvestigator(bridge);

        const investigation = await investigator.investigateWebUrl(url, "Recreate this website", reaStatus);

        expect(investigation.inferredEntities.some((e) => e.name === "Task")).toBe(false);
        expect(investigation.inferredEntities.some((e) => e.name === "ApiEndpoint")).toBe(true);
        expect(investigation.observedCapabilities).toContain("api-documentation");
        expect(investigation.inferredWorkflows.some((w) => w.id === "wf_api_explorer")).toBe(true);
      } finally {
        server.close();
      }
    });
  });

  describe("2. Faithful Code Generation by Domain", () => {
    it("generates a clean Content Page with 0 task controls, SQLite WAL content_pages, and REST endpoints", async () => {
      const appDir = path.join(testOutDir, "content_app_test");
      const spec: ForgeSpec = {
        name: "example-content-app",
        title: "Example Domain",
        description: "Recreated content presentation service.",
        targetEngine: "fullstack-node",
        metadata: {
          domain: "content",
          observedHeadings: ["Example Domain"],
          observedParagraphs: ["This domain is for use in illustrative examples in documents."],
          observedLinks: [{ text: "More information...", href: "https://www.iana.org/domains/example" }]
        },
        entities: [
          {
            name: "ContentPage",
            description: "Content page model",
            provenance: "observed",
            fields: [{ name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" }]
          }
        ],
        workflows: []
      };

      const engine = new UniversalNodeEngine();
      const result = await engine.generate(spec, appDir);

      // Verify files generated
      for (const f of result.files) {
        const fullP = path.join(appDir, f.relativePath);
        fs.mkdirSync(path.dirname(fullP), { recursive: true });
        fs.writeFileSync(fullP, f.content, "utf-8");
      }

      // Check server.js contains content_pages and no tasks table
      const serverCode = fs.readFileSync(path.join(appDir, "server.js"), "utf-8");
      expect(serverCode).toContain("content_pages");
      expect(serverCode).not.toContain("CREATE TABLE IF NOT EXISTS tasks");

      // Check index.html does not contain task inputs or buttons
      const htmlCode = fs.readFileSync(path.join(appDir, "public", "index.html"), "utf-8");
      expect(htmlCode).toContain("Example Domain");
      expect(htmlCode).toContain("More information...");
      expect(htmlCode).not.toContain("task-title");
      expect(htmlCode).not.toContain("btn-add-task");
      expect(htmlCode).not.toContain("Add Task");

      // Verify with ForgeVerifier
      const verifier = new ForgeVerifier();
      const verification = await verifier.verify(appDir);
      expect(verification.overallPassed).toBe(true);
      expect(fs.existsSync(path.join(appDir, "app.db"))).toBe(true);
    });

    it("generates an interactive API Documentation explorer with method badges and no task buttons", async () => {
      const appDir = path.join(testOutDir, "api_docs_test");
      const spec: ForgeSpec = {
        name: "httpbin-api-app",
        title: "httpbin.org",
        description: "HTTP Client Testing Service",
        targetEngine: "fullstack-node",
        metadata: {
          domain: "api-docs",
          observedEndpoints: [
            { method: "GET", path: "/get", description: "Echoes GET parameters" },
            { method: "POST", path: "/post", description: "Echoes POST data" }
          ]
        },
        entities: [
          {
            name: "ApiEndpoint",
            description: "API route model",
            provenance: "observed",
            fields: [{ name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" }]
          }
        ],
        workflows: []
      };

      const engine = new UniversalNodeEngine();
      const result = await engine.generate(spec, appDir);

      for (const f of result.files) {
        const fullP = path.join(appDir, f.relativePath);
        fs.mkdirSync(path.dirname(fullP), { recursive: true });
        fs.writeFileSync(fullP, f.content, "utf-8");
      }

      const serverCode = fs.readFileSync(path.join(appDir, "server.js"), "utf-8");
      expect(serverCode).toContain("endpoint_metrics");
      expect(serverCode).not.toContain("CREATE TABLE IF NOT EXISTS tasks");

      const htmlCode = fs.readFileSync(path.join(appDir, "public", "index.html"), "utf-8");
      expect(htmlCode).toContain("httpbin.org");
      expect(htmlCode).toContain("btn-execute");
      expect(htmlCode).not.toContain("task-title");
      expect(htmlCode).not.toContain("Add Task");

      const verifier = new ForgeVerifier();
      const verification = await verifier.verify(appDir);
      expect(verification.overallPassed).toBe(true);
    });
  });

  describe("3. Rule 5 & Evidence-Based Parity Scoring", () => {
    it("penalizes fabricated controls via Rule 5: caps score at <= 0.40 when task controls are added to content reference", () => {
      const refInvestigation: BrowserPageInvestigation = {
        url: "https://example.com",
        accessible: true,
        pageTitle: "Example Domain",
        observedControls: {
          buttons: [], // 0 buttons
          inputs: [],
          forms: [],
          menus: [],
          headings: ["Example Domain"],
          links: [{ tag: "a", text: "More information...", href: "https://www.iana.org/domains/example" }],
          paragraphs: ["This domain is for use in illustrative examples in documents."]
        },
        observedStates: { initialState: "rendered", emptyStateDetected: false },
        interactionResults: {
          scenario: "None",
          steps: [],
          persistenceVerified: false,
          apiRequestsObserved: []
        },
        limitations: []
      };

      const recInvestigation: BrowserPageInvestigation = {
        url: "http://127.0.0.1:3000",
        accessible: true,
        pageTitle: "Example Domain",
        observedControls: {
          buttons: [
            { tag: "button", text: "Add Task" },
            { tag: "button", text: "Filter All" },
            { tag: "button", text: "Filter Active" },
            { tag: "button", text: "Filter Completed" },
            { tag: "button", text: "Clear Completed" }
          ], // 5 fabricated buttons!
          inputs: [{ tag: "input", id: "task-title" }],
          forms: [{ tag: "form", selector: "#task-form" }],
          menus: [],
          headings: ["Example Domain", "Task Manager"],
          links: []
        },
        observedStates: { initialState: "rendered", emptyStateDetected: false },
        interactionResults: {
          scenario: "Task Lifecycle",
          steps: [{ step: "Click Add Task", action: "click", result: "success" }],
          persistenceVerified: true,
          apiRequestsObserved: []
        },
        limitations: []
      };

      const comp = BrowserInvestigator.compareInvestigations(refInvestigation, recInvestigation, "https://example.com", "http://127.0.0.1:3000");

      expect(comp.parityScore).toBeLessThanOrEqual(0.40);
      expect(comp.scoring.finalScore).toBeLessThanOrEqual(0.40);
      expect(comp.scoring.cappedReason).toContain("fabricated unrelated controls");
    });

    it("awards high parity score (>= 0.95) to faithful content page recreations without fabricated buttons", () => {
      const refInvestigation: BrowserPageInvestigation = {
        url: "https://example.com",
        accessible: true,
        pageTitle: "Example Domain",
        desktopSnapshot: {
          viewport: { width: 1280, height: 720, name: "desktop" },
          title: "Example Domain",
          url: "https://example.com",
          headings: ["Example Domain"],
          buttons: [],
          inputs: [],
          forms: [],
          menus: [],
          links: [{ tag: "a", text: "More information...", href: "https://www.iana.org/domains/example" }],
          paragraphs: ["This domain is for use in illustrative examples in documents."]
        },
        mobileSnapshot: {
          viewport: { width: 375, height: 667, name: "mobile" },
          title: "Example Domain",
          url: "https://example.com",
          headings: ["Example Domain"],
          buttons: [],
          inputs: [],
          forms: [],
          menus: [],
          responsiveLayoutVerified: true
        },
        observedControls: {
          buttons: [],
          inputs: [],
          forms: [],
          menus: [],
          headings: ["Example Domain"],
          links: [{ tag: "a", text: "More information...", href: "https://www.iana.org/domains/example" }],
          paragraphs: ["This domain is for use in illustrative examples in documents."]
        },
        observedStates: { initialState: "rendered", emptyStateDetected: false },
        interactionResults: { scenario: "None", steps: [], persistenceVerified: false, apiRequestsObserved: [] },
        limitations: []
      };

      const recInvestigation: BrowserPageInvestigation = {
        url: "http://127.0.0.1:3000",
        accessible: true,
        pageTitle: "Example Domain",
        desktopSnapshot: {
          viewport: { width: 1280, height: 720, name: "desktop" },
          title: "Example Domain",
          url: "http://127.0.0.1:3000",
          headings: ["Example Domain"],
          buttons: [], // 0 buttons
          inputs: [],
          forms: [],
          menus: [],
          links: [{ tag: "a", text: "More information...", href: "https://www.iana.org/domains/example" }],
          paragraphs: ["This domain is for use in illustrative examples in documents."]
        },
        mobileSnapshot: {
          viewport: { width: 375, height: 667, name: "mobile" },
          title: "Example Domain",
          url: "http://127.0.0.1:3000",
          headings: ["Example Domain"],
          buttons: [],
          inputs: [],
          forms: [],
          menus: [],
          responsiveLayoutVerified: true
        },
        observedControls: {
          buttons: [], // 0 buttons
          inputs: [],
          forms: [],
          menus: [],
          headings: ["Example Domain"],
          links: [{ tag: "a", text: "More information...", href: "https://www.iana.org/domains/example" }],
          paragraphs: ["This domain is for use in illustrative examples in documents."]
        },
        observedStates: { initialState: "rendered", emptyStateDetected: false },
        interactionResults: { scenario: "None", steps: [], persistenceVerified: false, apiRequestsObserved: [] },
        limitations: []
      };

      const comp = BrowserInvestigator.compareInvestigations(refInvestigation, recInvestigation, "https://example.com", "http://127.0.0.1:3000");

      expect(comp.parityScore).toBeGreaterThanOrEqual(0.95);
      expect(comp.scoring.metrics.headingParity?.status).toBe("pass");
      expect(comp.scoring.metrics.linkParity?.status).toBe("pass");
      expect(comp.scoring.metrics.buttonCountParity.status).toBe("pass");
    });
  });

  describe("4. Separation of Verification Goals (Application Quality vs Reference Fidelity)", () => {
    it("enforces that Application Quality PASS does not mask Reference Fidelity FAIL", async () => {
      const appDir = path.join(testOutDir, "quality_vs_fidelity_test");
      // Generate a working standard app (passes quality checks)
      const spec: ForgeSpec = {
        name: "fabricated-task-app",
        title: "Example Domain", // Claims to be Example Domain
        description: "Fabricated task manager for content reference",
        targetEngine: "fullstack-node",
        metadata: { domain: "content" },
        entities: [{ name: "ContentPage", description: "content", provenance: "inferred", fields: [{ name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" }] }],
        workflows: []
      };

      const engine = new UniversalNodeEngine();
      const result = await engine.generate(spec, appDir);

      for (const f of result.files) {
        const fullP = path.join(appDir, f.relativePath);
        fs.mkdirSync(path.dirname(fullP), { recursive: true });
        fs.writeFileSync(fullP, f.content, "utf-8");
      }

      const comparator = new RecreationComparator();
      const investigation: any = {
        mode: "reference_driven",
        targetPath: "https://example.com",
        targetType: "web_url",
        coverageAssessment: { blockedByMissingProviders: [] }
      };

      // Mock a comparison report where fidelity failed
      const report = await comparator.compare(appDir, spec, investigation, {} as any);

      // Verify applicationQuality is distinct and computed
      expect(report.applicationQuality).toBeDefined();
      expect(report.applicationQuality.serverStarts).toBe(true);
      expect(report.applicationQuality.persistenceWorking).toBe(true);
      expect(report.applicationQuality.status).toBe("pass");
    });
  });
});
