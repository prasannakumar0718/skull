import { ForgeSpec, TargetEngine, Provenance } from "../spec/schema.js";
import { RecreationInvestigation } from "./investigator.js";

export interface PlannedTask {
  id: string;
  stage: number;
  title: string;
  description: string;
  targetFiles: string[];
  acceptanceCriteria: string[];
  provenance: Provenance;
}

export interface ImplementationPlan {
  projectName: string;
  title: string;
  selectedEngine: TargetEngine;
  engineRationale: string;
  architecture: {
    frontend: string;
    backend: string;
    storage: string;
    exportPipeline?: string;
  };
  dependencies: Array<{ name: string; version: string; purpose: string }>;
  tasks: PlannedTask[];
  acceptanceCriteria: string[];
  knownUnknowns: string[];
  limitations: string[];
  createdAt: string;
}

export class ImplementationPlanner {
  public plan(spec: ForgeSpec, investigation: RecreationInvestigation, targetEngine: TargetEngine = "auto"): ImplementationPlan {
    const isWindows = process.platform === "win32";
    let selectedEngine: TargetEngine = targetEngine;

    let engineRationale = "";
    if (selectedEngine === "wasp") {
      engineRationale = "Wasp framework explicitly requested by caller. Scaffolding Wasp 0.26.1 declarative spec hierarchy.";
    } else if (selectedEngine === "fullstack-node") {
      engineRationale = "Universal Node Engine explicitly requested. Scaffolding zero-dependency Node HTTP + Native SQLite WAL architecture.";
    } else {
      // Auto selection logic
      if (isWindows) {
        selectedEngine = "fullstack-node";
        engineRationale = "Universal Node Engine selected for native Windows execution without requiring WSL or Haskell toolchain.";
      } else {
        selectedEngine = "fullstack-node";
        engineRationale = "Universal Node Engine selected for maximum portability, zero external runtime dependencies, and instant verification.";
      }
    }

    const isDocumentEditor = spec.metadata?.domain === "document-editor" ||
      spec.entities.some(e => e.name.toLowerCase().includes("document")) ||
      (spec.capabilities && spec.capabilities.includes("rich-text-editing"));

    // Architecture configuration
    const architecture = isDocumentEditor
      ? {
          frontend: "Interactive contenteditable rich-text canvas with formatting toolbar, autosave status, and document browser sidebar in Vanilla HTML5/CSS3/ESM",
          backend: "Zero-dependency Node HTTP REST server with document CRUD, autosave PATCH, and multi-format export (/api/documents/:id/export)",
          storage: "Native Node.js SQLite (node:sqlite) with WAL mode and Document + Revision relational schema",
          exportPipeline: "Server-side transforms to HTML, Markdown, Plain Text, and JSON"
        }
      : {
          frontend: "Responsive Vanilla HTML5/CSS3/ESM client with live REST data binding",
          backend: "Zero-dependency Node HTTP REST server",
          storage: "Native Node.js SQLite (node:sqlite) with WAL mode",
          exportPipeline: "Direct JSON and CSV serialization"
        };

    // Staged implementation tasks
    const tasks: PlannedTask[] = [
      {
        id: "task_1_storage",
        stage: 1,
        title: "Relational SQLite Storage & Schemas",
        description: `Set up persistent SQLite storage in app.db with table schemas for ${spec.entities.map(e => e.name).join(", ")}.`,
        targetFiles: ["server.js", "app.db"],
        acceptanceCriteria: [
          "Tables created with IF NOT EXISTS and proper column types",
          "PRAGMA journal_mode = WAL enabled for high concurrency",
          "Initial seed data injected when database is empty"
        ],
        provenance: "user_requested"
      },
      {
        id: "task_2_api_operations",
        stage: 2,
        title: "REST API Operations & Handlers",
        description: `Implement HTTP routes for queries and actions: ${spec.operations.map(o => o.name).join(", ")}.`,
        targetFiles: ["server.js"],
        acceptanceCriteria: [
          "GET endpoints return JSON arrays with 200 OK",
          "POST/PATCH endpoints validate required fields and return 201/200",
          "Health check at /api/health reports status: ok and storage: sqlite"
        ],
        provenance: "user_requested"
      },
      {
        id: "task_3_ui_and_workflows",
        stage: 3,
        title: "Interactive UI & User Workflows",
        description: `Build responsive client interface in public/ supporting observed workflows.`,
        targetFiles: ["public/index.html", "public/style.css", "public/app.js"],
        acceptanceCriteria: [
          "User can interact with all primary application workflows",
          "State updates automatically after server actions",
          "Clean visual styling with responsive design"
        ],
        provenance: "user_requested"
      }
    ];

    if (isDocumentEditor) {
      tasks.push(
        {
          id: "task_4_autosave",
          stage: 4,
          title: "Autosave & Document Recovery",
          description: "Implement debounced background autosave with visual status indicator (Saving... / Saved).",
          targetFiles: ["public/app.js", "server.js"],
          acceptanceCriteria: [
            "Autosave triggers after typing pause (500ms)",
            "Status indicator displays current persistence state",
            "Document content persists across browser refresh and server restarts"
          ],
          provenance: "user_requested"
        },
        {
          id: "task_5_export",
          stage: 5,
          title: "Multi-Format Document Export Pipeline",
          description: "Implement document export endpoint for HTML, Markdown, Plain Text, and JSON.",
          targetFiles: ["server.js", "public/app.js"],
          acceptanceCriteria: [
            "GET /api/documents/:id/export?format=html returns standalone HTML document",
            "GET /api/documents/:id/export?format=markdown returns markdown syntax",
            "GET /api/documents/:id/export?format=text returns plain text content",
            "GET /api/documents/:id/export?format=json returns structured document JSON"
          ],
          provenance: "user_requested"
        }
      );
    } else {
      // Map observed workflows for record/task applications into explicit planned tasks
      for (const wf of spec.workflows || []) {
        if (wf.id === "wf_view_filtering") {
          tasks.push({
            id: "task_view_filtering",
            stage: 3,
            title: "Multi-View & Status Filtering Controls",
            description: "Implement interactive filter buttons (All Tasks, Active, Completed, High Priority) and client-side list filtering.",
            targetFiles: ["public/index.html", "public/app.js", "server.js"],
            acceptanceCriteria: [
              "All filter buttons (All Tasks, Active, Completed, High Priority) render and switch active state",
              "Task list filters dynamically without full page refresh",
              "Counters update to reflect active filter counts"
            ],
            provenance: wf.provenance || "observed"
          });
        } else if (wf.id === "wf_status_lifecycle") {
          tasks.push({
            id: "task_status_lifecycle",
            stage: 3,
            title: "Status Lifecycle and Action Buttons",
            description: "Implement Complete / Reopen status transition toggle buttons and strike-through styling.",
            targetFiles: ["public/app.js", "server.js"],
            acceptanceCriteria: [
              "Complete button toggles task to completed state",
              "Reopen button reverts completed task to active state",
              "PATCH request persists status changes to SQLite database"
            ],
            provenance: wf.provenance || "observed"
          });
        } else if (wf.id === "wf_record_deletion") {
          tasks.push({
            id: "task_record_deletion",
            stage: 3,
            title: "Record Deletion & Confirmation",
            description: "Implement Delete action button on items and DELETE API endpoint handler.",
            targetFiles: ["public/app.js", "server.js"],
            acceptanceCriteria: [
              "Delete button sends DELETE /api/tasks/:id",
              "Item is removed from SQLite database and DOM immediately"
            ],
            provenance: wf.provenance || "observed"
          });
        }
      }
    }

    if (investigation.observedCapabilities.includes("browser-verified-ui") || investigation.observedCapabilities.includes("responsive-layout")) {
      tasks.push({
        id: "task_visual_responsive_parity",
        stage: 4,
        title: "Visual Hierarchy and Responsive Layout Parity",
        description: "Verify layout hierarchy and interactive controls at desktop (1280x720) and mobile (375x667) viewports.",
        targetFiles: ["public/style.css", "public/index.html"],
        acceptanceCriteria: [
          "Desktop layout presents header, formatting toolbar, document sidebar, and editor canvas",
          "Mobile layout adapts to 375px viewport with media query breakpoints and zero horizontal overflow",
          "Controls and buttons match observed reference hierarchy"
        ],
        provenance: "observed"
      });
    }

    tasks.push({
      id: "task_6_verification",
      stage: 6,
      title: "Automated Verification & Self-Testing",
      description: "Generate test.js and workflow.test.js to verify all acceptance criteria and workflows.",
      targetFiles: ["test.js", "workflow.test.js"],
      acceptanceCriteria: [
        "test.js verifies database creation, table schemas, and data persistence",
        "workflow.test.js executes each workflow sequence end-to-end against live endpoints",
        "Verification exits with code 0 when all criteria pass"
      ],
      provenance: "user_requested"
    });

    const allCriteria: string[] = [];
    for (const t of tasks) {
      allCriteria.push(...t.acceptanceCriteria);
    }
    if (spec.workflows) {
      for (const wf of spec.workflows) {
        allCriteria.push(...wf.acceptanceCriteria);
      }
    }

    return {
      projectName: spec.name,
      title: spec.title,
      selectedEngine,
      engineRationale,
      architecture,
      dependencies: [],
      tasks,
      acceptanceCriteria: Array.from(new Set(allCriteria)),
      knownUnknowns: investigation.unknowns,
      limitations: investigation.limitations,
      createdAt: new Date().toISOString()
    };
  }
}
