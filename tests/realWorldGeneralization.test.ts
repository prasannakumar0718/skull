import { describe, it, expect } from "vitest";
import * as http from "node:http";
import { BrowserInvestigator } from "../src/recreation/browserInvestigator.js";
import { RecreationInvestigator } from "../src/recreation/investigator.js";
import { UniversalNodeEngine } from "../src/engines/universalNodeEngine.js";
import { RecreationComparator } from "../src/recreation/comparator.js";
import { ForgeSpec } from "../src/spec/schema.js";

describe("Phase 15: Real-World Generalization & Robustness Suite", () => {
  it("extracts button labels from aria-label and title when textContent is empty", async () => {
    // Spin up an ephemeral HTTP server with aria-label and title buttons
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Button Label Test</title></head>
          <body>
            <button aria-label="Expand operation GET /status"></button>
            <button title="Collapse operation POST /submit"><svg></svg></button>
            <button class="btn">Standard Button</button>
          </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const result = await BrowserInvestigator.investigateWebPage(testUrl);

      expect(result.accessible).toBe(true);
      expect(result.observedControls.buttons).toBeDefined();
      expect(result.observedControls.buttons.length).toBe(3);

      const labels = result.observedControls.buttons.map((b) => b.text);
      expect(labels).toContain("Expand operation GET /status");
      expect(labels).toContain("Collapse operation POST /submit");
      expect(labels).toContain("Standard Button");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("submits single-input forms via Enter keypress when no explicit submit button exists", async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Single Input Enter Test</title></head>
          <body>
            <div id="app">
              <input id="task-title" type="text" placeholder="What needs to be done?" />
              <ul id="items-list"></ul>
            </div>
            <script>
              const input = document.getElementById('task-title');
              const list = document.getElementById('items-list');
              input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.value.trim()) {
                  const li = document.createElement('li');
                  li.textContent = input.value;
                  list.appendChild(li);
                }
              });
            </script>
          </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const result = await BrowserInvestigator.investigateWebPage(testUrl);

      expect(result.accessible).toBe(true);
      const enterStep = result.interactionResults.steps.find((s) => s.action === "type" && s.value === "Enter" && s.step.includes("Enter"));
      expect(enterStep).toBeDefined();
      expect(enterStep?.result).toBe("success");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("does not falsely infer rich-text-editing from external swagger-editor or casual substring references", async () => {
    const investigator = new RecreationInvestigator();
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>API Documentation</title></head>
          <body>
            <h1>Service Documentation</h1>
            <p>Designed using swagger-editor v3.0 and openapi generator.</p>
            <div class="api-endpoints">
              <a href="/api/status">Status</a>
            </div>
          </body>
        </html>
      `);
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const result = await investigator.investigate(`Recreate ${testUrl}`, testUrl);
      expect(result.observedCapabilities).not.toContain("rich-text-editing");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("aligns UniversalNodeEngine and RecreationComparator domain logic without false 404s", () => {
    const genericSpec: ForgeSpec = {
      name: "generic-service",
      title: "Generic Service",
      description: "Service documentation and API explorer",
      targetEngine: "auto",
      entities: [
        {
          name: "Item",
          description: "Synthesized item record",
          provenance: "inferred",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" },
            { name: "title", type: "String", isId: false, isRequired: true, provenance: "inferred" }
          ]
        }
      ],
      operations: [
        { name: "getItems", type: "query", entities: ["Item"], description: "Get items", provenance: "inferred" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "MainPage", isProtected: false, provenance: "inferred" }
      ],
      workflows: [
        {
          id: "wf_main",
          name: "Main Workflow",
          description: "Explore endpoints",
          trigger: "User opens page",
          provenance: "inferred",
          steps: [{ step: 1, action: "View", expectedOutcome: "Page renders", provenance: "inferred" }],
          acceptanceCriteria: ["Page loads"]
        }
      ],
      coverageAssessment: {
        totalWorkflows: 1,
        observedWorkflows: 0,
        inferredWorkflows: 1,
        unknownWorkflows: 0,
        blockedByMissingProviders: [],
        confidenceScore: 0.85
      },
      metadata: {
        domain: "generic"
      }
    };

    const engine = new UniversalNodeEngine();
    const genResult = (engine as any).generateStandardApp(genericSpec);
    expect(genResult.files.some((f: any) => f.relativePath === "server.js")).toBe(true);

    const serverFile = genResult.files.find((f: any) => f.relativePath === "server.js");
    expect(serverFile.content).toContain("/api/tasks");
    expect(serverFile.content).not.toContain("/api/documents");
  });
});
