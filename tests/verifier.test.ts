import { describe, it, expect } from "vitest";
import { ForgeVerifier } from "../src/verifier/verifier.js";
import { EngineOrchestrator } from "../src/engines/orchestrator.js";
import { createSpecFromPrompt } from "../src/spec/validator.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("ForgeVerifier & Self-Repair Fault-Injection Suite", () => {
  it("detects missing directory error", async () => {
    const verifier = new ForgeVerifier();
    const report = await verifier.verify("D:/non-existent-proj-9876");

    expect(report.overallPassed).toBe(false);
    expect(report.checks[0].classification).toBe("MISSING_FILE");
  });

  it("handles missing package.json structural fault", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-fault-pkg-"));
    const verifier = new ForgeVerifier();
    const report = await verifier.verify(tempDir);

    expect(report.overallPassed).toBe(false);
    const structCheck = report.checks.find((c) => c.name === "Structure Check");
    expect(structCheck?.passed).toBe(false);
    expect(structCheck?.classification).toBe("MISSING_FILE");

    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("automatically repairs missing SQLite storage and confirms post-repair success", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-fault-db-"));
    const spec = createSpecFromPrompt("Build a task manager with persistent storage", "repair-test");
    spec.targetEngine = "fullstack-node";

    const orchestrator = new EngineOrchestrator();
    await orchestrator.generateProject(spec, tempDir);

    // Delete app.db to inject missing storage fault
    const dbPath = path.join(tempDir, "app.db");
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath);
    }

    const verifier = new ForgeVerifier();
    const report = await verifier.verify(tempDir);

    expect(report.overallPassed).toBe(true);
    expect(report.repairedIssues.length).toBeGreaterThan(0);
    expect(report.repairedIssues[0]).toContain("Initialized SQLite database schema in app.db");
    expect(fs.existsSync(dbPath)).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("bounds execution time and avoids hanging on hanging test scripts", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-fault-hang-"));
    fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
    // Injected fault: infinite while loop that never terminates
    fs.writeFileSync(path.join(tempDir, "test.js"), "while(true) {}");

    const verifier = new ForgeVerifier();
    const startTime = Date.now();
    const report = await verifier.verify(tempDir);
    const duration = Date.now() - startTime;

    expect(report.overallPassed).toBe(false);
    const testCheck = report.checks.find((c) => c.name === "Unit/Structural Verification");
    expect(testCheck?.passed).toBe(false);
    expect(testCheck?.classification).toBe("TIMEOUT");
    // Verifier must terminate within ~11 seconds and not hang forever
    expect(duration).toBeLessThan(15000);

    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }, 16000); // Set Vitest timeout to 16s

  it("probes live server via probeLiveServer and cleanly terminates process", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-probe-test-"));
    const spec = createSpecFromPrompt("Build a task manager", "probe-app");
    spec.targetEngine = "fullstack-node";

    const orchestrator = new EngineOrchestrator();
    await orchestrator.generateProject(spec, tempDir);

    // Run verifier self-repair to ensure db exists
    const verifier = new ForgeVerifier();
    await verifier.verify(tempDir);

    const probeResult = await verifier.probeLiveServer(tempDir, 3991);
    expect(probeResult.success).toBe(true);
    expect(probeResult.data?.status).toBe("ok");
    expect(probeResult.data?.app).toBe("probe-app");
    expect(probeResult.data?.storage).toBe("sqlite");

    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
});
