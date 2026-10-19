import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ReaInvestigationBridge } from "../src/investigation/reaBridge.js";
import { DatabaseSync } from "node:sqlite";
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

describe("Phase 12.1: Zero-Capability-Loss Parity & Acceptance Audit Suite", () => {
  const tempDbPath = path.resolve("./temp_phase12_parity.db");

  beforeAll(() => {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    const db = new DatabaseSync(tempDbPath);
    db.exec("CREATE TABLE test_parity (id INTEGER PRIMARY KEY, item TEXT);");
    db.exec("INSERT INTO test_parity (item) VALUES ('parity_verified');");
    db.close();
  });

  afterAll(() => {
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    }
  });

  it("proves 100% schema parity across all 207 tools between live REA runtime and Forge catalog", async () => {
    const bridge = new ReaInvestigationBridge();
    const parity = await bridge.validateParityWithLiveRea();

    expect(parity.liveToolCount).toBe(207);
    expect(parity.catalogToolCount).toBe(207);
    expect(parity.missingInCatalog).toEqual([]);
    expect(parity.missingInLive).toEqual([]);
    expect(parity.schemaMismatches).toEqual([]);
    expect(parity.versionMismatch).toBe(false);
    expect(parity.isMatch).toBe(true);
  }, 45000);

  it("identifies exact REA version launched by Forge and verifies version metadata", () => {
    const bridge = new ReaInvestigationBridge();
    const version = bridge.getReaVersion();
    const meta = bridge.getCatalogMetadata();

    expect(version).toBe("6.7.0");
    expect(meta.catalogVersion).toBe("6.7.0");
    expect(meta.sourcePackage).toBe("rea-agents");
    expect(meta.toolCount).toBe(207);
  });

  it("handles cancellation via AbortSignal before tool execution begins", async () => {
    const bridge = new ReaInvestigationBridge();
    const controller = new AbortController();
    controller.abort(); // pre-aborted

    const result = await bridge.callReaNativeTool(
      "inspect_sqlite_database",
      { path: tempDbPath, schema_scope: "database" },
      controller.signal
    );

    expect(result.isError).toBe(true);
    expect(result.isCancelled).toBe(true);
    expect(result.error).toContain("cancelled by client signal before execution");
  });

  it("handles in-flight cancellation via AbortSignal during execution", async () => {
    const bridge = new ReaInvestigationBridge();
    const controller = new AbortController();

    // Trigger abort after 10ms to cancel during setup/execution
    setTimeout(() => {
      controller.abort();
    }, 10);

    const result = await bridge.callReaNativeTool(
      "inspect_sqlite_database",
      { path: tempDbPath, schema_scope: "database" },
      controller.signal
    );

    expect(result.isError).toBe(true);
    expect(result.isCancelled).toBe(true);
    expect(result.error).toContain("cancelled");
  });

  it("preserves native REA structured evidence and limitations without truncation", async () => {
    const bridge = new ReaInvestigationBridge();
    const result = await bridge.callReaNativeTool("inspect_sqlite_database", {
      path: tempDbPath.replace(/\\/g, "/"),
      schema_scope: "database"
    });

    expect(result.isError).toBe(false);
    expect(result.data).toBeDefined();

    // Verify structured output shape returned by REA
    const data = result.data;
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content.length).toBeGreaterThan(0);
    expect(data.content[0].text).toContain("SQLite");

    // Verify structuredContent if provided by upstream REA
    if (data.structuredContent) {
      expect(data.structuredContent.evidence_id).toMatch(/^ev_/);
      expect(data.structuredContent.normalized_result).toBeDefined();
    }
  }, 45000);

  it("programmatically confirms upstream repositories (wasp and rea) remain 100% pristine and unmodified", () => {
    const waspStatus = execSync("git -C \"../wasp\" status --porcelain", { encoding: "utf-8" }).trim();
    const reaStatus = execSync("git -C \"../rea\" status --porcelain", { encoding: "utf-8" }).trim();

    expect(waspStatus).toBe("");
    expect(reaStatus).toBe("");

    const waspBranch = execSync("git -C \"../wasp\" rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    const reaBranch = execSync("git -C \"../rea\" rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();

    expect(waspBranch).toBe("main");
    expect(reaBranch).toBe("main");
  });
});
