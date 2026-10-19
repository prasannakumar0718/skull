import { describe, it, expect } from "vitest";
import { createSpecFromPrompt, validateForgeSpec } from "../src/spec/validator.js";

describe("Phase 13: Recreation Specification & Provenance Suite", () => {
  it("generates rich document editor specification from natural language prompt", () => {
    const spec = createSpecFromPrompt(
      "Recreate Microsoft Word as an independent web application with rich-text editing, formatting, autosave, and export",
      "word-recreation"
    );

    expect(spec.name).toBe("word-recreation");
    expect(spec.title).toContain("Document Studio");
    expect(spec.capabilities).toContain("rich-text-editing");
    expect(spec.capabilities).toContain("autosave");
    expect(spec.capabilities).toContain("document-export");

    // Entities
    const entityNames = spec.entities.map((e) => e.name);
    expect(entityNames).toContain("Document");
    expect(entityNames).toContain("Revision");

    // Operations
    const opNames = spec.operations.map((o) => o.name);
    expect(opNames).toContain("getDocuments");
    expect(opNames).toContain("createDocument");
    expect(opNames).toContain("autosaveDocument");
    expect(opNames).toContain("exportDocument");

    // Workflows
    expect(spec.workflows).toBeDefined();
    expect(spec.workflows!.length).toBeGreaterThanOrEqual(3);
    const wfIds = spec.workflows!.map((w) => w.id);
    expect(wfIds).toContain("wf_doc_editing");
    expect(wfIds).toContain("wf_doc_autosave");
    expect(wfIds).toContain("wf_doc_export");

    // Provenance tagging
    const docEntity = spec.entities.find((e) => e.name === "Document")!;
    expect(docEntity.provenance).toBe("user_requested");
    for (const f of docEntity.fields) {
      expect(["user_requested", "inferred", "observed", "unknown"]).toContain(f.provenance);
    }

    // Coverage assessment
    expect(spec.coverageAssessment).toBeDefined();
    expect(spec.coverageAssessment!.totalWorkflows).toBeGreaterThanOrEqual(3);
    expect(spec.coverageAssessment!.confidenceScore).toBeGreaterThanOrEqual(0.9);

    const validation = validateForgeSpec(spec);
    expect(validation.result.valid).toBe(true);
    expect(validation.result.errors).toEqual([]);
  });

  it("validates workflows and detects duplicate workflow IDs", () => {
    const spec = createSpecFromPrompt("Task manager", "task-wf-test");
    spec.workflows = [
      {
        id: "wf_dup",
        name: "Workflow 1",
        description: "Test",
        trigger: "Click",
        steps: [{ step: 1, action: "Do", expectedOutcome: "Done", provenance: "user_requested" }],
        acceptanceCriteria: ["Success"],
        provenance: "user_requested"
      },
      {
        id: "wf_dup", // duplicate ID
        name: "Workflow 2",
        description: "Test",
        trigger: "Click",
        steps: [{ step: 1, action: "Do", expectedOutcome: "Done", provenance: "user_requested" }],
        acceptanceCriteria: ["Success"],
        provenance: "user_requested"
      }
    ];

    const validation = validateForgeSpec(spec);
    expect(validation.result.valid).toBe(false);
    expect(validation.result.errors.some((e) => e.includes("Duplicate workflow ID"))).toBe(true);
  });

  it("preserves backward compatibility for greenfield specifications without workflows", () => {
    const legacySpec = {
      name: "legacy-app",
      title: "Legacy App",
      description: "Simple app",
      targetEngine: "auto" as const,
      entities: [
        {
          name: "Item",
          fields: [
            { name: "id", type: "Int" as const, isId: true, isRequired: true },
            { name: "name", type: "String" as const, isId: false, isRequired: true }
          ]
        }
      ],
      operations: [
        { name: "getItems", type: "query" as const, entities: ["Item"] }
      ],
      routes: [
        { name: "Home", path: "/", component: "Home", isProtected: false }
      ]
    };

    const validation = validateForgeSpec(legacySpec);
    expect(validation.result.valid).toBe(true);
    expect(validation.spec?.workflows).toEqual([]);
  });
});
