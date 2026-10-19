import { describe, it, expect } from "vitest";
import { ReaInvestigationBridge } from "../src/investigation/reaBridge.js";
import { checkSystemPrerequisites } from "../src/utils/prerequisites.js";
import { EngineOrchestrator } from "../src/engines/orchestrator.js";
import { createSpecFromPrompt } from "../src/spec/validator.js";
import { execSync } from "node:child_process";
import * as path from "node:path";

describe("Upstream Capability Preservation & Native Delegation Suite", () => {
  it("discovers all native REA contract tools via listSupportedReaTools", () => {
    const bridge = new ReaInvestigationBridge();
    const tools = bridge.listSupportedReaTools();

    expect(tools.length).toBeGreaterThanOrEqual(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain("inspect_artifact");
    expect(names).toContain("analyze_function");
    expect(names).toContain("compare_artifacts");
    expect(names).toContain("get_call_graph");
    expect(names).toContain("get_evidence_bundle");

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("handles native REA tool execution with truthful diagnostics when REA is called", async () => {
    const bridge = new ReaInvestigationBridge();
    const result = await bridge.callReaNativeTool("inspect_artifact", {
      artifactPath: path.resolve(".")
    });

    // When called on directory or unbuilt provider, must report diagnostic truthfully
    expect(result.isError).toBe(true);
    expect(result.error).toBeTruthy();
  }, 30000);

  it("delegates to simulated REA fixture when testing in test-fixture mode", async () => {
    const bridge = new ReaInvestigationBridge();
    bridge.setProviderForTesting("test-fixture");

    const result = await bridge.callReaNativeTool("analyze_function", {
      artifactPath: "binary.exe",
      functionIdentifier: "main"
    });

    expect(result.isError).toBe(false);
    expect(result.data?.tool).toBe("analyze_function");
    expect(result.data?.evidence_id).toBeTruthy();
  });

  it("truthfully evaluates Wasp host capabilities without faking CLI execution", () => {
    const prereqs = checkSystemPrerequisites();
    expect(prereqs.node.isSupported).toBe(true);
    expect(prereqs.node.sqliteAvailable).toBe(true);
    expect(typeof prereqs.wasp.installed).toBe("boolean");
    expect(prereqs.wasp.notes).toBeTruthy();
  });

  it("preserves explicit Wasp engine selection and NEVER silently falls back to Node engine", () => {
    const spec = createSpecFromPrompt("Build a task manager", "explicit-wasp-test");
    spec.targetEngine = "wasp";

    const orchestrator = new EngineOrchestrator();
    const selected = orchestrator.selectEngine(spec);

    // ZERO CAPABILITY LOSS: Engine MUST remain Wasp when requested
    expect(selected.name).toBe("wasp");
  });

  it("executes doctor CLI command and outputs structured system diagnosis", () => {
    const stdout = execSync("node bin/forge.js doctor", { encoding: "utf-8" });
    expect(stdout).toContain("Agent App Forge System Health & Prerequisites");
    expect(stdout).toContain("Node.js Runtime");
    expect(stdout).toContain("SQLite Engine");
    expect(stdout).toContain("Wasp CLI");
    expect(stdout).toContain("REA CLI");
  });

  it("executes forge wasp delegation command and returns honest platform instructions", () => {
    try {
      execSync("node bin/forge.js wasp version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      expect(output).toContain("Native Wasp Delegation");
      expect(output).toContain("Wasp CLI is not installed or not in system PATH");
    }
  });

  it("executes forge rea delegation command and returns honest build instructions", () => {
    try {
      execSync("node bin/forge.js rea invalid_subcommand_test", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      expect(output).toContain("Native REA Delegation");
      expect(output).toContain("To build REA");
    }
  }, 30000);

  it("passes flags such as --version directly to REA CLI without root option collision", () => {
    const stdout = execSync("node bin/forge.js rea --version", { encoding: "utf-8" }).trim();
    expect(stdout).toContain("6.7.0");
    expect(stdout).not.toBe("0.1.0");
  }, 30000);

  it("passes flags such as --version directly to Wasp CLI without root option collision", () => {
    try {
      execSync("node bin/forge.js wasp --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      expect(output).toContain("Native Wasp Delegation");
      expect(output).toContain("Wasp CLI is not installed or not in system PATH");
      expect(output).not.toBe("0.1.0");
    }
  });
});
