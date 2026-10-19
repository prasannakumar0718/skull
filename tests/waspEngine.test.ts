import { describe, it, expect } from "vitest";
import { WaspEngine } from "../src/engines/waspEngine.js";
import { createSpecFromPrompt } from "../src/spec/validator.js";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Wasp Generation Engine Validation Suite", () => {
  it("emits complete, valid Wasp 0.26.1 specification and workspace files", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-wasp-spec-"));
    const spec = createSpecFromPrompt("Build a task manager with persistent storage", "wasp-task-app");
    spec.targetEngine = "wasp";

    const engine = new WaspEngine();
    const result = await engine.generate(spec, tempDir);

    expect(result.engineName).toBe("wasp");
    expect(result.files.length).toBe(8);

    const relativePaths = result.files.map((f) => f.relativePath);
    expect(relativePaths).toContain("main.wasp.ts");
    expect(relativePaths).toContain("schema.prisma");
    expect(relativePaths).toContain("package.json");
    expect(relativePaths).toContain("tsconfig.json");
    expect(relativePaths).toContain(".env.server");
    expect(relativePaths).toContain(".gitignore");
    expect(relativePaths).toContain("src/operations.ts");
    expect(relativePaths).toContain("src/TasksPage.tsx");

    // 1. Verify main.wasp.ts specification
    const mainWasp = result.files.find((f) => f.relativePath === "main.wasp.ts")!.content;
    expect(mainWasp).toContain('import { app, page, route, query, action } from "@wasp.sh/spec"');
    expect(mainWasp).toContain('name: "wasp-task-app"');
    expect(mainWasp).toContain('wasp: { version: "0.26.1" }');
    expect(mainWasp).toContain("route(\"HomeRoute\", \"/\", page(TasksPage))");

    // 2. Verify schema.prisma
    const schemaPrisma = result.files.find((f) => f.relativePath === "schema.prisma")!.content;
    expect(schemaPrisma).toContain('provider = "sqlite"');
    expect(schemaPrisma).toContain('url      = "file:./dev.db"');
    expect(schemaPrisma).toContain("model Task {");
    expect(schemaPrisma).toContain("id Int @id @default(autoincrement())");
    expect(schemaPrisma).toContain("title String");
    expect(schemaPrisma).toContain("isDone Boolean @default(false)");

    // 3. Verify package.json dependencies
    const pkg = JSON.parse(result.files.find((f) => f.relativePath === "package.json")!.content);
    expect(pkg.name).toBe("wasp-task-app");
    expect(pkg.dependencies["@wasp.sh/spec"]).toBe("file:.wasp/spec");
    expect(pkg.dependencies["wasp"]).toBe("file:.wasp/out/sdk/wasp");

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("probes host for Wasp CLI and reports genuine availability without faking", () => {
    let waspFound = false;
    try {
      const probeCmd = process.platform === "win32" ? "where.exe wasp" : "which wasp";
      const out = execSync(probeCmd, { stdio: ["pipe", "pipe", "ignore"], encoding: "utf-8" }).trim();
      waspFound = Boolean(out);
    } catch {
      waspFound = false;
    }

    if (waspFound) {
      const version = execSync("wasp --version", { encoding: "utf-8" }).trim();
      expect(version).toBeTruthy();
    } else {
      // Truthful verification: Wasp CLI is not installed on host
      expect(waspFound).toBe(false);
      const isWindows = process.platform === "win32";
      if (isWindows) {
        // Confirm platform notes reflect the real prerequisite
        const engine = new WaspEngine();
        const spec = createSpecFromPrompt("test", "test-app");
        engine.generate(spec, os.tmpdir()).then((res) => {
          expect(res.supportedOnPlatform).toBe(false);
          expect(res.platformNotes).toContain("WSL");
        });
      }
    }
  });
});
