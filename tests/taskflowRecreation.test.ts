import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as net from "node:net";
import { spawn } from "node:child_process";
import { BrowserInvestigator } from "../src/recreation/browserInvestigator.js";

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

describe("Task 3: Second Authorized Target (TaskFlow) Browser Investigation & Parity Audit", () => {
  const refDir = path.resolve("fixtures/taskflow-reference");
  const recDir = path.resolve("outputs/browser-taskflow-recreation");
  const compDir = path.join(recDir, "comparison");

  it("Executes live browser comparison between TaskFlow reference and recreation", async () => {
    expect(fs.existsSync(refDir)).toBe(true);

    if (!fs.existsSync(recDir)) {
      const { createSpecFromPrompt } = await import("../src/spec/validator.js");
      const { EngineOrchestrator } = await import("../src/engines/orchestrator.js");
      const spec = createSpecFromPrompt("TaskFlow — Project & Task Management", "browser-taskflow-recreation");
      spec.title = "TaskFlow — Project & Task Management";
      spec.targetEngine = "fullstack-node";
      const orchestrator = new EngineOrchestrator();
      await orchestrator.generateProject(spec, recDir);
    }

    expect(fs.existsSync(recDir)).toBe(true);

    const refPort = await getAvailablePort();
    const recPort = await getAvailablePort();

    let refServer: any = null;
    let recServer: any = null;

    try {
      refServer = spawn(process.execPath, ["server.js"], {
        cwd: refDir,
        env: { ...process.env, PORT: String(refPort), NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"]
      });

      recServer = spawn(process.execPath, ["server.js"], {
        cwd: recDir,
        env: { ...process.env, PORT: String(recPort), NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"]
      });

      // Wait for both servers to bind
      await new Promise((r) => setTimeout(r, 800));

      const comp = await BrowserInvestigator.compareWebApplications(
        `http://127.0.0.1:${refPort}`,
        `http://127.0.0.1:${recPort}`,
        { outputDir: compDir }
      );

      // Save comparison artifact in output directory
      fs.writeFileSync(
        path.join(recDir, "browser-comparison.json"),
        JSON.stringify(comp, null, 2),
        "utf-8"
      );

      // 1. Verify separate results recorded
      expect(comp.referenceUrl).toContain(String(refPort));
      expect(comp.recreationUrl).toContain(String(recPort));

      // 2. Verify browser observations
      expect(comp.visualComparison.referenceTitle).toBe("TaskFlow — Project & Task Management");
      expect(comp.visualComparison.recreationTitle).toBe("Task Manager Application");
      expect(comp.visualComparison.titleMatch).toBe(false);

      // 3. Verify control differences detected
      expect(comp.visualComparison.buttonsMatch.referenceCount).toBeGreaterThan(0);
      expect(comp.visualComparison.buttonsMatch.recreationCount).toBeGreaterThan(0);
      expect(comp.behavioralComparison.differences.some(d => d.includes("Title difference"))).toBe(true);
      expect(comp.behavioralComparison.differences.some(d => d.includes("variance"))).toBe(true);

      // 4. Verify documented scoring: because title and button controls differ, parity score cannot equal 1.0
      expect(comp.parityScore).toBeLessThan(1.0);
      expect(comp.scoring.formula).toBeDefined();

      // 5. Verify screenshots captured for both viewports
      const refDesktop = comp.visualComparison.screenshots.referenceDesktop;
      const recDesktop = comp.visualComparison.screenshots.recreationDesktop;
      const refMobile = comp.visualComparison.screenshots.referenceMobile;
      const recMobile = comp.visualComparison.screenshots.recreationMobile;

      expect(fs.existsSync(refDesktop!)).toBe(true);
      expect(fs.existsSync(recDesktop!)).toBe(true);
      expect(fs.existsSync(refMobile!)).toBe(true);
      expect(fs.existsSync(recMobile!)).toBe(true);

      expect(fs.statSync(refDesktop!).size).toBeGreaterThan(1000);
      expect(fs.statSync(recDesktop!).size).toBeGreaterThan(1000);
      expect(fs.statSync(refMobile!).size).toBeGreaterThan(1000);
      expect(fs.statSync(recMobile!).size).toBeGreaterThan(1000);

      // 6. Verify non-pixel-perfect disclaimer
      expect(comp.visualComparison.imageDiffPerformed).toBe(false);
      expect(comp.visualComparison.disclaimer).toContain("Pixel-level bitmap diffing was not performed");
    } finally {
      if (refServer) {
        try { refServer.kill(); } catch {}
      }
      if (recServer) {
        try { recServer.kill(); } catch {}
      }
    }
  }, 60000);
});
