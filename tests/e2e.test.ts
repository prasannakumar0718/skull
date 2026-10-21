import { describe, it, expect } from "vitest";
import { createSpecFromPrompt, validateForgeSpec } from "../src/spec/validator.js";
import { EngineOrchestrator } from "../src/engines/orchestrator.js";
import { ForgeVerifier } from "../src/verifier/verifier.js";
import { spawn } from "node:child_process";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function makeRequest(method: string, url: string, body?: any): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options: http.RequestOptions = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      headers: {
        "Content-Type": "application/json"
      }
    };

    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode || 0, data: raw ? JSON.parse(raw) : {} });
        } catch {
          resolve({ statusCode: res.statusCode || 0, data: raw });
        }
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe("End-to-End MVP Verification: Persistent Task Manager Lifecycle", () => {
  it("executes complete lifecycle: spec -> synthesis -> verification -> CRUD -> restart persistence", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-e2e-mvp-"));
    const port = 4123;

    try {
      // Step 1: Create specification
      const prompt = "Build a task manager with persistent storage";
      const spec = createSpecFromPrompt(prompt, "task-manager-mvp");
      spec.targetEngine = "fullstack-node";
      const { result: valResult } = validateForgeSpec(spec);
      expect(valResult.valid).toBe(true);

      // Step 2 & 3: Select engine and generate
      const orchestrator = new EngineOrchestrator();
      const genResult = await orchestrator.generateProject(spec, tempDir);
      expect(genResult.files.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(tempDir, "server.js"))).toBe(true);

      // Step 4: Run verification and self-repair
      const verifier = new ForgeVerifier();
      const verifyReport = await verifier.verify(tempDir);
      expect(verifyReport.overallPassed).toBe(true);

      // Step 5: Launch server instance 1
      const server1 = spawn(process.execPath, ["server.js"], {
        cwd: tempDir,
        env: { ...process.env, PORT: String(port), NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"]
      });

      // Wait for server 1 to be ready
      await new Promise((r) => setTimeout(r, 400));

      // Health check
      const health1 = await makeRequest("GET", `http://127.0.0.1:${port}/api/health`);
      expect(health1.statusCode).toBe(200);
      expect(health1.data.status).toBe("ok");
      expect(health1.data.storage).toBe("sqlite");

      // Step 6: Create task via API
      const createRes = await makeRequest("POST", `http://127.0.0.1:${port}/api/tasks`, {
        title: "Verify persistent storage across restart"
      });
      expect(createRes.statusCode).toBe(201);
      const createdId = createRes.data.id;
      expect(createdId).toBeGreaterThan(0);

      // Read back from server 1
      const list1 = await makeRequest("GET", `http://127.0.0.1:${port}/api/tasks`);
      expect(list1.statusCode).toBe(200);
      const taskFound1 = list1.data.find((t: any) => t.id === createdId);
      expect(taskFound1).toBeDefined();
      expect(taskFound1.title).toBe("Verify persistent storage across restart");

      // Terminate server 1
      server1.kill();
      await new Promise((r) => setTimeout(r, 300));

      // Step 7: Cold Restart - Launch server instance 2 on same database
      const server2 = spawn(process.execPath, ["server.js"], {
        cwd: tempDir,
        env: { ...process.env, PORT: String(port), NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"]
      });

      await new Promise((r) => setTimeout(r, 400));

      // Read back from server 2 to verify persistence
      const list2 = await makeRequest("GET", `http://127.0.0.1:${port}/api/tasks`);
      expect(list2.statusCode).toBe(200);
      const taskFound2 = list2.data.find((t: any) => t.id === createdId);
      expect(taskFound2).toBeDefined();
      expect(taskFound2.title).toBe("Verify persistent storage across restart");

      // Cleanly terminate server 2
      server2.kill();
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      // Step 8: Clean up temporary directory safely on Windows
      try {
        fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      } catch {}
    }
  });
});
