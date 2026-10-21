import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createForgeMcpServer } from "../src/mcp/server.js";

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

describe("Agent App Forge — Zero-Configuration User Experience Suite", () => {
  let client: Client;
  let server: ReturnType<typeof createForgeMcpServer>;

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    server = createForgeMcpServer();
    await server.connect(serverTransport);

    client = new Client({ name: "zero-config-test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    try {
      await client.close();
      await server.close();
    } catch {}
  });

  // Scenario 1: Prompt-only app generation (zero config: no targetPath, no outputDirectory, no targetEngine)
  it("Scenario 1: Prompt-only app generation: 'Build me a student management application with attendance and fee tracking.'", async () => {
    const prompt = "Build me a student management application with attendance and fee tracking.";

    const res: any = await client.callTool({
      name: "forge_recreate_app",
      arguments: {
        prompt
      }
    });

    expect(res.isError).toBeFalsy();
    expect(res.content).toBeDefined();
    expect(res.content.length).toBeGreaterThanOrEqual(2);

    const recResult = JSON.parse(res.content.find((c: any) => c.text.startsWith("{"))?.text || res.content[0].text);
    const formattedReport = res.content.find((c: any) => c.text.startsWith("# Agent App Forge"))?.text || res.content[1].text;

    // 1. Automatic classification verification
    expect(recResult.finalReport).toBeDefined();
    const classif = recResult.finalReport.requestClassification;
    expect(classif.type).toBe("new_application");
    expect(classif.domain).toBe("student-management");
    expect(classif.mode).toBe("greenfield");

    // 2. Automatic output directory derivation
    expect(recResult.outputDirectory).toBeTruthy();
    expect(recResult.outputDirectory).toContain("student-management-app");

    // 3. Artifact synthesis & structural verification
    expect(recResult.success).toBe(true);
    expect(recResult.spec.title).toContain("Student Management");
    expect(recResult.spec.entities.some((e: any) => e.name === "Student")).toBe(true);

    const outDir = recResult.outputDirectory;
    expect(fs.existsSync(path.join(outDir, "server.js"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "app.db"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "public", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "test.js"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "workflow.test.js"))).toBe(true);

    // 4. Verifier and test execution
    expect(recResult.verification.overallPassed).toBe(true);

    // 5. User-friendly report verification
    expect(formattedReport).toContain("# Agent App Forge — Execution Report");
    expect(formattedReport).toContain("How to Run");
    expect(formattedReport).toContain("node server.js");
    expect(formattedReport).toContain("Tested Features");

    expect(recResult.finalReport.runInstructions.command).toBe("node server.js");
    expect(recResult.finalReport.testedFeatures.length).toBeGreaterThan(0);
    expect(recResult.finalReport.results.overallStatus).toBe("PASSED");
  }, 90000);

  // Scenario 2: Accessible website recreation with embedded URL (zero config: no separate targetPath)
  it("Scenario 2: Accessible website recreation: 'Recreate this website: http://127.0.0.1:<port>'", async () => {
    const mockPort = await getAvailablePort();
    const mockHtml = `<!DOCTYPE html>
<html>
<head><title>Acme Academic Portal</title></head>
<body>
  <header><h1>Acme Academic Portal</h1></header>
  <main>
    <button id="btn-login">Student Login</button>
    <button id="btn-register">Register Account</button>
    <button id="btn-portal">Campus Portal</button>
  </main>
</body>
</html>`;

    const mockServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(mockHtml);
    });

    await new Promise<void>((resolve) => mockServer.listen(mockPort, "127.0.0.1", () => resolve()));

    try {
      const targetUrl = `http://127.0.0.1:${mockPort}`;
      const prompt = `Recreate this website: ${targetUrl}`;

      const res: any = await client.callTool({
        name: "forge_recreate_app",
        arguments: {
          prompt
        }
      });

      expect(res.isError).toBeFalsy();
      const recResult = JSON.parse(res.content.find((c: any) => c.text.startsWith("{"))?.text || res.content[0].text);
      const formattedReport = res.content.find((c: any) => c.text.startsWith("# Agent App Forge"))?.text || res.content[1].text;

      // 1. Classification & URL extraction
      expect(recResult.finalReport.requestClassification.type).toBe("reference_recreation");
      expect(recResult.finalReport.requestClassification.target).toBe(targetUrl);
      expect(recResult.finalReport.requestClassification.mode).toBe("reference_driven");

      // 2. Automated tool discovery & execution (REA / Web)
      expect(recResult.investigation.targetType).toBe("web_url");
      expect(recResult.investigation.targetClassification.accessible).toBe(true);

      // 3. Observed evidence flowed into spec
      expect(recResult.spec.title).toBe("Acme Academic Portal");
      expect(recResult.investigation.evidence.length).toBeGreaterThan(0);

      // 4. Verification and report
      expect(recResult.success).toBe(true);
      expect(formattedReport).toContain("Acme Academic Portal");
      expect(formattedReport).toContain("Output Directory:");
      expect(recResult.finalReport.runInstructions.command).toBe("node server.js");
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  }, 90000);

  // Scenario 3: Inaccessible-URL scenario (honesty verification: never claim inspection, communicate limitations)
  it("Scenario 3: Inaccessible-URL scenario: 'Recreate this website: http://127.0.0.1:59998/offline-service'", async () => {
    const offlineUrl = "http://127.0.0.1:59998/offline-service";
    const prompt = `Recreate this website: ${offlineUrl}`;

    const res: any = await client.callTool({
      name: "forge_recreate_app",
      arguments: {
        prompt
      }
    });

    // Should complete gracefully without crashing or throwing
    expect(res.content).toBeDefined();
    const recResult = JSON.parse(res.content.find((c: any) => c.text.startsWith("{"))?.text || res.content[0].text);
    const formattedReport = res.content.find((c: any) => c.text.startsWith("# Agent App Forge"))?.text || res.content[1].text;

    // 1. Target classified honestly as inaccessible
    expect(recResult.investigation.targetType).toBe("web_url");
    expect(recResult.investigation.targetClassification.accessible).toBe(false);

    // 2. Truthful evidence check: NO fabricated live website evidence
    expect(recResult.investigation.evidence.length).toBe(0);

    // 3. Limitations communicated clearly and honestly
    expect(recResult.finalReport.limitations.length).toBeGreaterThan(0);
    const hasUnreachableLimitation = recResult.finalReport.limitations.some(
      (l: string) => l.includes("inaccessible") || l.includes("unreachable") || l.includes("failed")
    );
    expect(hasUnreachableLimitation).toBe(true);

    // 4. Formatted report communicates the limitation
    expect(formattedReport).toMatch(/Known Limitations|unreachable|inaccessible|offline/i);
    expect(formattedReport).toContain(offlineUrl);
  }, 90000);
});
