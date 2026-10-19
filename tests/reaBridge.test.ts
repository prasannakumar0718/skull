import { describe, it, expect } from "vitest";
import { ReaInvestigationBridge } from "../src/investigation/reaBridge.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("REA Investigation Bridge Integrity Suite", () => {
  it("truthfully probes REA installation status", () => {
    const reaRepoPath = path.resolve("../rea");
    const bridge = new ReaInvestigationBridge(reaRepoPath);
    const status = bridge.probeReaStatus();

    expect(status).toBeDefined();
    expect(typeof status.cliFound).toBe("boolean");
    expect(typeof status.mcpFound).toBe("boolean");
    expect(status.details).toBeTruthy();

    // Since node_modules in ../rea is not installed, mcpFound must be false
    expect(status.mcpFound).toBe(false);
    expect(status.details).toContain("node_modules");
  });

  it("accurately classifies native source parsing as forge-source-parser", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-rea-test-"));
    const prismaFile = path.join(tempDir, "schema.prisma");
    fs.writeFileSync(
      prismaFile,
      `model Task {\n  id Int @id\n  title String\n}\n\nmodel Project {\n  id Int @id\n  name String\n}`
    );

    const bridge = new ReaInvestigationBridge(path.resolve("../rea"));
    const result = await bridge.investigate(tempDir);

    expect(result.reaAvailable).toBe(false);
    expect(result.provider).toBe("forge-source-parser");
    expect(result.suggestedEntities).toContain("Task");
    expect(result.suggestedEntities).toContain("Project");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0].kind).toBe("schema");

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("extracts SQL tables and TypeScript routes cleanly in native parser", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-rea-sql-test-"));
    const sqlFile = path.join(tempDir, "schema.sql");
    fs.writeFileSync(
      sqlFile,
      `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);\nCREATE TABLE orders (id INTEGER PRIMARY KEY);`
    );

    const routeFile = path.join(tempDir, "api.ts");
    fs.writeFileSync(
      routeFile,
      `export async function getUsers() {}\nexport async function createOrder() {}`
    );

    const bridge = new ReaInvestigationBridge();
    const result = await bridge.investigate(tempDir);

    expect(result.provider).toBe("forge-source-parser");
    expect(result.suggestedEntities).toContain("users");
    expect(result.suggestedEntities).toContain("orders");
    expect(result.suggestedOperations).toContain("getUsers");
    expect(result.suggestedOperations).toContain("createOrder");

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("supports deterministic test-fixture mode", async () => {
    const bridge = new ReaInvestigationBridge();
    bridge.setProviderForTesting("test-fixture");

    const result = await bridge.investigate(path.resolve("."));

    expect(result.provider).toBe("test-fixture");
    expect(result.reaAvailable).toBe(true);
    expect(result.evidence[0].kind).toBe("binary-structure");
    expect(result.suggestedEntities).toContain("TaskRecord");
  });

  it("throws clear error on non-existent investigation target", async () => {
    const bridge = new ReaInvestigationBridge();
    await expect(bridge.investigate("D:/non-existent-dir-12345")).rejects.toThrow(
      "Target investigation path does not exist"
    );
  });
});
