import { describe, it, expect } from "vitest";
import { createSpecFromPrompt } from "../src/spec/validator.js";
import { ImplementationPlanner } from "../src/recreation/planner.js";
import { RecreationInvestigator } from "../src/recreation/investigator.js";

describe("Phase 13: Implementation Planner Suite", () => {
  it("produces machine-readable implementation plan with staged tasks and architecture", async () => {
    const investigator = new RecreationInvestigator();
    const investigation = await investigator.investigate(
      "Recreate Microsoft Word document editor with autosave and export"
    );

    const spec = createSpecFromPrompt(
      "Recreate Microsoft Word document editor with autosave and export",
      "word-plan-test"
    );

    const planner = new ImplementationPlanner();
    const plan = planner.plan(spec, investigation, "auto");

    expect(plan.projectName).toBe("word-plan-test");
    expect(plan.selectedEngine).toBe("fullstack-node");
    expect(plan.engineRationale).toBeTruthy();

    expect(plan.architecture.frontend).toContain("contenteditable");
    expect(plan.architecture.backend).toContain("Node HTTP");
    expect(plan.architecture.storage).toContain("SQLite");
    expect(plan.architecture.exportPipeline).toBeDefined();

    expect(plan.tasks.length).toBeGreaterThanOrEqual(5);
    const taskIds = plan.tasks.map((t) => t.id);
    expect(taskIds).toContain("task_1_storage");
    expect(taskIds).toContain("task_2_api_operations");
    expect(taskIds).toContain("task_3_ui_and_workflows");
    expect(taskIds).toContain("task_4_autosave");
    expect(taskIds).toContain("task_5_export");

    for (const task of plan.tasks) {
      expect(task.title).toBeTruthy();
      expect(task.stage).toBeGreaterThan(0);
      expect(task.targetFiles.length).toBeGreaterThan(0);
      expect(task.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(task.provenance).toBeDefined();
    }

    expect(plan.acceptanceCriteria.length).toBeGreaterThan(0);
  });

  it("identifies known unknowns when specialized binary export features are requested", async () => {
    const investigator = new RecreationInvestigator();
    const investigation = await investigator.investigate(
      "Recreate application with direct native DOCX and PDF export"
    );

    const spec = createSpecFromPrompt("App with docx export", "docx-test");
    const planner = new ImplementationPlanner();
    const plan = planner.plan(spec, investigation, "fullstack-node");

    expect(plan.knownUnknowns.length).toBeGreaterThan(0);
    expect(plan.knownUnknowns.some((u) => u.includes("DOCX") || u.includes("export"))).toBe(true);
  });
});
