import { execSync, spawn } from "node:child_process";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";

function makeRequest(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      headers: { "Content-Type": "application/json" }
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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAudit() {
  console.log("=== STARTING REAL APP WORKFLOW & CLI AUDIT ===");
  const specPath = path.resolve("./temp_bug_spec.json");
  const appDir = path.resolve("./temp_cli_app");
  const port = 59231;

  try {
    // 1. Standalone CLI Help
    console.log("[1/8] Verifying standalone 'forge --help'...");
    const helpOut = execSync("node bin/forge.js --help", { encoding: "utf-8" });
    if (!helpOut.includes("Usage: forge") || !helpOut.includes("doctor") || !helpOut.includes("create")) {
      throw new Error("CLI --help failed to render expected commands.");
    }
    console.log(" -> CLI help verified.");

    // 2. Doctor check
    console.log("[2/8] Verifying 'forge doctor'...");
    const doctorOut = execSync("node bin/forge.js doctor", { encoding: "utf-8" });
    if (!doctorOut.includes("System Health & Prerequisites")) {
      throw new Error("CLI doctor output missing header.");
    }
    console.log(" -> CLI doctor verified.");

    // 3. Spec generation via CLI
    console.log("[3/8] Verifying 'forge spec'...");
    if (fs.existsSync(specPath)) fs.unlinkSync(specPath);
    execSync(`node bin/forge.js spec "Build a bug tracker with persistent database" -o "${specPath}"`, { encoding: "utf-8" });
    if (!fs.existsSync(specPath)) throw new Error("Spec file was not created.");
    const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
    if (!spec.entities || spec.entities.length === 0) throw new Error("Generated spec has no entities.");
    console.log(` -> Created spec with ${spec.entities.length} entities and ${spec.operations.length} operations.`);

    // 4. Project build via CLI
    console.log("[4/8] Verifying 'forge create'...");
    if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
    execSync(`node bin/forge.js create "${specPath}" -o "${appDir}" -e fullstack-node`, { encoding: "utf-8" });
    if (!fs.existsSync(path.join(appDir, "server.js"))) throw new Error("server.js was not generated.");
    console.log(" -> App successfully built.");

    // 5. App verification via CLI
    console.log("[5/8] Verifying 'forge verify'...");
    const verifyOut = execSync(`node bin/forge.js verify "${appDir}"`, { encoding: "utf-8" });
    if (!verifyOut.includes("Verification Report") || !verifyOut.includes("PASSED")) {
      throw new Error("forge verify failed: " + verifyOut);
    }
    console.log(" -> App verification passed.");

    // 6. Launch server instance 1 & test API
    console.log("[6/8] Starting generated app server (instance 1)...");
    const server1 = spawn(process.execPath, ["server.js"], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await new Promise((r) => setTimeout(r, 600));

    const health1 = await makeRequest("GET", `http://127.0.0.1:${port}/api/health`);
    if (health1.statusCode !== 200 || health1.data.storage !== "sqlite") {
      throw new Error(`Health check failed: ${JSON.stringify(health1)}`);
    }

    const createRes = await makeRequest("POST", `http://127.0.0.1:${port}/api/tasks`, {
      title: "Release blocker bug #101"
    });
    if (createRes.statusCode !== 201 || !createRes.data.id) {
      throw new Error(`Create task failed: ${JSON.stringify(createRes)}`);
    }
    const createdId = createRes.data.id;
    console.log(` -> Created task #${createdId}: '${createRes.data.title}'`);

    const listRes1 = await makeRequest("GET", `http://127.0.0.1:${port}/api/tasks`);
    const found1 = listRes1.data.find((t) => t.id === createdId);
    if (!found1) throw new Error("Created task not returned in list.");
    console.log(" -> Task verified in active memory/database.");

    // Kill server 1
    server1.kill();
    await new Promise((r) => setTimeout(r, 500));

    // Confirm database file on disk
    const dbPath = path.join(appDir, "app.db");
    if (!fs.existsSync(dbPath)) throw new Error("app.db file missing after server shutdown!");
    const stat = fs.statSync(dbPath);
    console.log(` -> SQLite database verified on disk (${stat.size} bytes).`);

    // 7. Restart server instance 2 & test persistence across restart
    console.log("[7/8] Restarting generated app server (instance 2) to test SQLite persistence...");
    const server2 = spawn(process.execPath, ["server.js"], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await new Promise((r) => setTimeout(r, 600));

    const listRes2 = await makeRequest("GET", `http://127.0.0.1:${port}/api/tasks`);
    const found2 = listRes2.data.find((t) => t.id === createdId);
    if (!found2) throw new Error("Task failed to persist across server restart!");
    console.log(` -> PERSISTENCE VERIFIED: Task #${createdId} successfully restored from SQLite across process restarts.`);

    server2.kill();
    await new Promise((r) => setTimeout(r, 500));

    // 8. Standalone Wasp and REA delegation verification
    console.log("[8/8] Verifying standalone Wasp & REA delegation...");
    try {
      execSync("node bin/forge.js wasp version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      throw new Error("Expected 'forge wasp version' to report WSL absence on Windows without WSL.");
    } catch (err) {
      const out = (err.stdout || "") + (err.stderr || "");
      if (!out.includes("Native Wasp Delegation") || !out.includes("Wasp CLI is not installed or not in system PATH")) {
        throw new Error("Unexpected output from forge wasp delegation: " + out);
      }
      console.log(" -> Wasp delegation truthfully reported WSL absence without claiming false build.");
    }

    const reaOut = execSync("node bin/forge.js rea --version", { encoding: "utf-8" });
    if (!reaOut.includes("6.7.0")) {
      throw new Error("forge rea --version did not return 6.7.0: " + reaOut);
    }
    console.log(" -> REA CLI delegation verified (REA version 6.7.0).");

    console.log("=== ALL WORKFLOW & STANDALONE CLI CHECKS PASSED ===");
  } finally {
    // Cleanup
    if (fs.existsSync(specPath)) {
      try { fs.unlinkSync(specPath); } catch {}
    }
    if (fs.existsSync(appDir)) {
      try { fs.rmSync(appDir, { recursive: true, force: true }); } catch {}
    }
  }
}

runAudit().catch((err) => {
  console.error("FATAL ERROR IN WORKFLOW AUDIT:", err);
  process.exit(1);
});
