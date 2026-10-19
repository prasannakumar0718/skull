import { describe, it, expect } from "vitest";
import { createSpecFromPrompt, validateForgeSpec } from "../src/spec/validator.js";
import { EngineOrchestrator } from "../src/engines/orchestrator.js";
import { ForgeVerifier } from "../src/verifier/verifier.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Agent App Forge Core Suite", () => {
  it("converts a user prompt into a valid ForgeSpec", () => {
    const prompt = "Build a task manager with persistent storage";
    const spec = createSpecFromPrompt(prompt, "task-manager-test");
    const { result } = validateForgeSpec(spec);

    expect(result.valid).toBe(true);
    expect(spec.name).toBe("task-manager-test");
    expect(spec.entities.length).toBeGreaterThan(0);
    expect(spec.entities[0].name).toBe("Task");
    expect(spec.operations.some((op) => op.name === "createTask")).toBe(true);
  });

  it("orchestrates synthesis and generates complete application files", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-test-"));
    const spec = createSpecFromPrompt("Build a task manager with persistent storage", "quick-task");
    const orchestrator = new EngineOrchestrator();

    const result = await orchestrator.generateProject(spec, tempDir);

    expect(result.files.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tempDir, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "forgespec.json"))).toBe(true);

    // Run automated verification loop
    const verifier = new ForgeVerifier();
    const report = await verifier.verify(tempDir);

    expect(report.overallPassed).toBe(true);
    expect(report.checks.some((c) => c.name === "Structure Check" && c.passed)).toBe(true);

    // Cleanup temp
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates Wasp-compliant specification and prisma schema when target is wasp", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-wasp-test-"));
    const spec = createSpecFromPrompt("Build a task manager", "wasp-task");
    spec.targetEngine = "wasp";

    const orchestrator = new EngineOrchestrator();
    const result = await orchestrator.generateProject(spec, tempDir);

    expect(result.engineName).toBe("wasp");
    expect(fs.existsSync(path.join(tempDir, "main.wasp.ts"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "schema.prisma"))).toBe(true);

    const mainWasp = fs.readFileSync(path.join(tempDir, "main.wasp.ts"), "utf-8");
    expect(mainWasp).toContain('import { app, page, route, query, action } from "@wasp.sh/spec"');
    expect(mainWasp).toContain("export default app({");

    // Cleanup temp
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
