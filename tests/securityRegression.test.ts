import { describe, it, expect } from "vitest";
import { EngineOrchestrator } from "../src/engines/orchestrator.js";
import { createSpecFromPrompt, validateForgeSpec } from "../src/spec/validator.js";
import { checkSystemPrerequisites } from "../src/utils/prerequisites.js";
import { ForgeVerifier } from "../src/verifier/verifier.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Security & Reliability Regression Suite", () => {
  it("blocks path traversal via relative parent '..' paths", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-sec-rel-"));
    const spec = createSpecFromPrompt("Security test", "sec-test");
    const orchestrator = new EngineOrchestrator();

    const evilEngine = {
      name: "fullstack-node",
      canHandle: () => true,
      generate: async () => ({
        engineName: "fullstack-node",
        files: [{ relativePath: "../../outside.txt", content: "evil" }],
        entryPointInstructions: "",
        supportedOnPlatform: true
      })
    };
    (orchestrator as any).engines = [evilEngine];

    await expect(orchestrator.generateProject(spec, tempDir)).rejects.toThrow(
      "Security Exception: File path escape detected"
    );

    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5 });
  });

  it("blocks path traversal via absolute and Windows drive root paths", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-sec-abs-"));
    const spec = createSpecFromPrompt("Security test", "sec-test");
    const orchestrator = new EngineOrchestrator();

    const evilEngine = {
      name: "fullstack-node",
      canHandle: () => true,
      generate: async () => ({
        engineName: "fullstack-node",
        files: [{ relativePath: process.platform === "win32" ? "C:\\evil.txt" : "/evil.txt", content: "evil" }],
        entryPointInstructions: "",
        supportedOnPlatform: true
      })
    };
    (orchestrator as any).engines = [evilEngine];

    await expect(orchestrator.generateProject(spec, tempDir)).rejects.toThrow(
      "Security Exception: File path escape detected"
    );

    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5 });
  });

  it("sanitizes command injection attempts in application prompts and names", () => {
    const maliciousName = "test; rm -rf /; calc.exe && whoami";
    const spec = createSpecFromPrompt("Normal prompt", maliciousName);

    expect(spec.name).toMatch(/^[a-z0-9_-]+$/);
    expect(spec.name).not.toContain(";");
    expect(spec.name).not.toContain("&");
    expect(spec.name).not.toContain(" ");

    const { result } = validateForgeSpec(spec);
    expect(result.valid).toBe(true);
  });

  it("enforces minimum Node.js runtime version check for node:sqlite", () => {
    const prereqs = checkSystemPrerequisites();
    expect(prereqs.node.major).toBeGreaterThanOrEqual(22);
    expect(prereqs.node.sqliteAvailable).toBe(true);
  });

  it("redacts potential secrets from verification logs and reports", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-sec-secret-"));
    fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
    fs.writeFileSync(
      path.join(tempDir, "test.js"),
      'console.log("Database token=super_secret_token_12345"); process.exit(0);'
    );

    const verifier = new ForgeVerifier();
    const report = await verifier.verify(tempDir);

    const unitCheck = report.checks.find((c) => c.name === "Unit/Structural Verification");
    expect(unitCheck?.details).toBeDefined();
    expect(unitCheck?.details).toContain("[REDACTED]");
    expect(unitCheck?.details).not.toContain("super_secret_token_12345");

    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5 });
  });

  it("handles malformed JSON specifications safely without crashing", () => {
    const { result } = validateForgeSpec({ invalid: true, numbers: [1, 2, 3] });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
