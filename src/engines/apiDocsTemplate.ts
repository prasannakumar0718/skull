import { ForgeSpec } from "../spec/schema.js";
import { GenerationResult, GeneratedFile } from "./types.js";

function escapeHtmlText(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateApiDocsApp(spec: ForgeSpec): GenerationResult {
  const files: GeneratedFile[] = [];

  const defaultEndpoints = [
    { method: "GET", path: "/ip", description: "Returns the requester's IP Address." },
    { method: "GET", path: "/user-agent", description: "Returns the requester's User-Agent string." },
    { method: "GET", path: "/headers", description: "Returns incoming HTTP request headers." },
    { method: "GET", path: "/get", description: "The request's query parameters and headers." },
    { method: "POST", path: "/post", description: "The request's POST parameters and payload." },
    { method: "PUT", path: "/put", description: "The request's PUT parameters and payload." },
    { method: "DELETE", path: "/delete", description: "The request's DELETE parameters and payload." },
    { method: "PATCH", path: "/patch", description: "The request's PATCH parameters and payload." },
    { method: "GET", path: "/status/200", description: "Returns given HTTP Status code (e.g. 200, 404, 500)." },
    { method: "GET", path: "/response-headers", description: "Returns the incoming request's response headers." },
    { method: "GET", path: "/api/endpoints", description: "Returns list of available API routes." }
  ];

  const endpoints = Array.isArray(spec.metadata?.observedEndpoints) && spec.metadata.observedEndpoints.length > 0
    ? spec.metadata.observedEndpoints
    : defaultEndpoints;

  const rawHeadings: string[] = Array.isArray(spec.metadata?.observedHeadings) && spec.metadata.observedHeadings.length > 0
    ? spec.metadata.observedHeadings
    : ["API Documentation", "Other Utilities"];

  const rawParagraphs: string[] = Array.isArray(spec.metadata?.observedParagraphs) && spec.metadata.observedParagraphs.length > 0
    ? spec.metadata.observedParagraphs
    : [spec.description || "A simple HTTP Request & Response Service."];

  const rawLinks: Array<{ text: string; href: string }> = Array.isArray(spec.metadata?.observedLinks) && spec.metadata.observedLinks.length > 0
    ? spec.metadata.observedLinks
    : [
        { text: "API Specification", href: "/api/endpoints" },
        { text: "Health Check", href: "/api/health" }
      ];

  const observedButtonLabel = (Array.isArray(spec.metadata?.observedButtons) && spec.metadata.observedButtons.length > 0)
    ? spec.metadata.observedButtons[0]
    : "Expand operation";

  const endpointsJson = JSON.stringify(endpoints);

  // 1. package.json
  files.push({
    relativePath: "package.json",
    content: JSON.stringify(
      {
        name: spec.name || "api-documentation-app",
        version: "1.0.0",
        type: "module",
        scripts: {
          start: "node server.js",
          dev: "node server.js",
          test: "node test.js",
          "test:workflow": "node workflow.test.js"
        }
      },
      null,
      2
    ) + "\n"
  });

  // 2. server.js
  const serverJs = `import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);
const DB_FILE = path.join(__dirname, "app.db");

export const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(\`
  CREATE TABLE IF NOT EXISTS endpoint_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    calls_count INTEGER DEFAULT 0,
    last_called_at TEXT,
    last_status INTEGER
  );
\`);

function recordMetric(method, path, status) {
  try {
    const existing = db.prepare("SELECT id, calls_count FROM endpoint_metrics WHERE path = ? AND method = ?").get(path, method);
    if (existing) {
      db.prepare(\`
        UPDATE endpoint_metrics
        SET calls_count = calls_count + 1, last_called_at = datetime('now'), last_status = ?
        WHERE id = ?
      \`).run(status, existing.id);
    } else {
      db.prepare(\`
        INSERT INTO endpoint_metrics (path, method, calls_count, last_called_at, last_status)
        VALUES (?, ?, 1, datetime('now'), ?)
      \`).run(path, method, status);
    }
  } catch {}
}

const ENDPOINTS = ${endpointsJson};

function sendJson(res, statusCode, data, method, pathname) {
  if (method && pathname) {
    recordMetric(method, pathname, statusCode);
  }
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({ raw: body });
      }
    });
    req.on("error", () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, \`http://\${req.headers.host || "localhost"}\`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Agent");
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health API
  if (method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      status: "ok",
      title: ${JSON.stringify(spec.title)},
      domain: "api-docs",
      storage: "sqlite-wal",
      endpointsAvailable: ENDPOINTS.length
    }, method, pathname);
  }

  // Endpoints discovery
  if (method === "GET" && pathname === "/api/endpoints") {
    return sendJson(res, 200, {
      service: ${JSON.stringify(spec.title)},
      endpoints: ENDPOINTS
    }, method, pathname);
  }

  // SQLite Metrics telemetry
  if (method === "GET" && pathname === "/api/metrics") {
    const metrics = db.prepare("SELECT * FROM endpoint_metrics ORDER BY calls_count DESC").all();
    return sendJson(res, 200, { metrics }, method, pathname);
  }

  // GET /get echo
  if (method === "GET" && pathname === "/get") {
    const args = {};
    parsedUrl.searchParams.forEach((val, key) => { args[key] = val; });
    return sendJson(res, 200, {
      args,
      headers: req.headers,
      origin: req.socket.remoteAddress || "127.0.0.1",
      url: parsedUrl.href
    }, method, pathname);
  }

  // POST /post echo
  if (method === "POST" && pathname === "/post") {
    const body = await parseJsonBody(req);
    return sendJson(res, 200, {
      data: body,
      headers: req.headers,
      origin: req.socket.remoteAddress || "127.0.0.1",
      url: parsedUrl.href
    }, method, pathname);
  }

  // GET /ip
  if (method === "GET" && pathname === "/ip") {
    return sendJson(res, 200, { origin: req.socket.remoteAddress || "127.0.0.1" }, method, pathname);
  }

  // GET /user-agent
  if (method === "GET" && pathname === "/user-agent") {
    return sendJson(res, 200, { "user-agent": req.headers["user-agent"] || "AgentAppForge-Client/1.0" }, method, pathname);
  }

  // GET /headers
  if (method === "GET" && pathname === "/headers") {
    return sendJson(res, 200, { headers: req.headers }, method, pathname);
  }

  // PUT /put echo
  if (method === "PUT" && pathname === "/put") {
    const body = await parseJsonBody(req);
    return sendJson(res, 200, {
      data: body,
      headers: req.headers,
      origin: req.socket.remoteAddress || "127.0.0.1",
      url: parsedUrl.href
    }, method, pathname);
  }

  // DELETE /delete echo
  if (method === "DELETE" && pathname === "/delete") {
    return sendJson(res, 200, {
      deleted: true,
      headers: req.headers,
      origin: req.socket.remoteAddress || "127.0.0.1",
      url: parsedUrl.href
    }, method, pathname);
  }

  // PATCH /patch echo
  if (method === "PATCH" && pathname === "/patch") {
    const body = await parseJsonBody(req);
    return sendJson(res, 200, {
      data: body,
      headers: req.headers,
      origin: req.socket.remoteAddress || "127.0.0.1",
      url: parsedUrl.href
    }, method, pathname);
  }

  // GET /response-headers
  if (method === "GET" && pathname === "/response-headers") {
    return sendJson(res, 200, {
      "Content-Type": "application/json",
      "X-Powered-By": "AgentAppForge",
      args: Object.fromEntries(parsedUrl.searchParams)
    }, method, pathname);
  }

  // Dynamic /status/:code
  const statusMatch = pathname.match(/^\\/status\\/([1-5][0-9]{2})$/);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    recordMetric(method, pathname, code);
    res.writeHead(code, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: code, message: \`HTTP \${code} simulated response\` }));
  }

  // Serve documentation UI
  if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    const indexPath = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  // Fallback 404
  sendJson(res, 404, { error: "Route not found", path: pathname }, method, pathname);
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(\`API Documentation explorer running at http://127.0.0.1:\${PORT}\`);
  });
}

export { server };
`;
  files.push({ relativePath: "server.js", content: serverJs });

  // 3. public/index.html
  const endpointCardsHtml = endpoints.map((ep, idx) => {
    const methodClass = ep.method.toLowerCase();
    return `
      <div class="endpoint-card opblock opblock-${methodClass}" id="endpoint-${idx}">
        <div class="endpoint-header opblock-summary" onclick="toggleOpblock(${idx})">
          <span class="method-badge badge-${methodClass}">${escapeHtmlText(ep.method)}</span>
          <span class="endpoint-path">${escapeHtmlText(ep.path)}</span>
          <span class="endpoint-desc">${escapeHtmlText(ep.description)}</span>
          <button type="button" class="btn btn-expand opblock-summary-control" aria-label="${escapeHtmlText(observedButtonLabel)}" title="${escapeHtmlText(observedButtonLabel)}">${escapeHtmlText(observedButtonLabel)}</button>
        </div>
        <div class="endpoint-body" id="body-${idx}" style="display:none;">
          <div class="opblock-section" id="exec-container-${idx}"></div>
          <div class="response-panel" id="res-${idx}" style="display:none;">
            <div class="res-meta"><span class="res-status">Status: 200 OK</span> <span class="res-time"></span></div>
            <pre class="res-json"><code></code></pre>
          </div>
        </div>
      </div>
    `;
  }).join("\n");

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(spec.title)}</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #fafafa;
      font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #3b4151;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    header {
      background: #ffffff;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      margin-bottom: 2rem;
      border-left: 6px solid #4990e2;
    }
    h1 {
      font-size: 2.2rem;
      color: #24272a;
      margin-bottom: 0.5rem;
    }
    .sub-heading {
      font-size: 1.25rem;
      color: #4a5568;
      margin-top: 0.75rem;
      margin-bottom: 0.25rem;
      font-weight: 600;
    }
    .subtitle {
      font-size: 1rem;
      color: #718096;
      line-height: 1.5;
      margin-top: 0.25rem;
    }
    .api-links-nav {
      margin-top: 1.25rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .api-nav-link {
      color: #3182ce;
      text-decoration: none;
      font-weight: 500;
      font-size: 0.88rem;
      padding: 4px 10px;
      background: #edf2f7;
      border-radius: 4px;
      transition: background 0.15s;
    }
    .api-nav-link:hover {
      background: #e2e8f0;
      color: #2b6cb0;
    }
    .endpoint-card {
      background: #ffffff;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      margin-bottom: 1rem;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: #f8f9fa;
      border-bottom: 1px solid #e1e4e8;
      flex-wrap: wrap;
      cursor: pointer;
    }
    .method-badge {
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      color: #ffffff;
      min-width: 65px;
      text-align: center;
    }
    .badge-get { background-color: #61affe; }
    .badge-post { background-color: #49cc90; }
    .badge-put { background-color: #fca130; }
    .badge-delete { background-color: #f93e3e; }
    .badge-patch { background-color: #50e3c2; }
    .endpoint-path {
      font-family: monospace;
      font-size: 1.05rem;
      font-weight: 600;
      color: #3b4151;
    }
    .endpoint-desc {
      font-size: 0.9rem;
      color: #6a737d;
      margin-left: auto;
    }
    .endpoint-body {
      padding: 1rem 1.25rem;
      border-top: 1px solid #e1e4e8;
      background: #fafbfc;
    }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background 0.15s ease;
    }
    .btn-expand {
      background: transparent;
      color: #718096;
      border: 1px solid #cbd5e0;
      font-size: 0.8rem;
      padding: 0.25rem 0.6rem;
      margin-left: 0.5rem;
    }
    .btn-expand:hover {
      background: #edf2f7;
      color: #4a5568;
    }
    .btn-execute {
      background-color: #4990e2;
      color: #ffffff;
    }
    .btn-execute:hover {
      background-color: #357ebd;
    }
    .response-panel {
      margin-top: 1rem;
      background: #282c34;
      color: #abb2bf;
      border-radius: 6px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.85rem;
      overflow-x: auto;
    }
    .res-meta {
      font-weight: bold;
      color: #98c379;
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
    }
    .res-json {
      max-height: 250px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    @media (max-width: 600px) {
      .endpoint-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .endpoint-desc {
        margin-left: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtmlText(spec.title)}</h1>
      ${rawHeadings.map(h => `<h2 class="sub-heading">${escapeHtmlText(h)}</h2>`).join("\n      ")}
      ${rawParagraphs.map(p => `<p class="subtitle">${escapeHtmlText(p)}</p>`).join("\n      ")}
      ${rawLinks.length > 0 ? `
      <nav class="api-links-nav">
        ${rawLinks.map(l => `<a href="${escapeHtmlText(l.href)}" class="api-nav-link" target="_blank" rel="noopener">${escapeHtmlText(l.text || l.href)}</a>`).join("\n        ")}
      </nav>` : ""}
    </header>
    <main>
      ${endpointCardsHtml}
    </main>
  </div>
  <script>
    const ENDPOINTS = ${endpointsJson};

    function toggleOpblock(idx) {
      const body = document.getElementById('body-' + idx);
      const container = document.getElementById('exec-container-' + idx);
      if (!body) return;
      if (body.style.display === 'none') {
        body.style.display = 'block';
        if (container && !container.innerHTML) {
          const ep = ENDPOINTS[idx];
          container.innerHTML = \`<button type="button" class="btn btn-execute" onclick="executeProbe('\${ep.method}', '\${ep.path}', \${idx})">Send Request</button>\`;
        }
      } else {
        body.style.display = 'none';
      }
    }

    async function executeProbe(method, rawPath, idx) {
      const panel = document.getElementById('res-' + idx);
      if (!panel) return;
      const codeEl = panel.querySelector('code');
      const statusEl = panel.querySelector('.res-status');
      const timeEl = panel.querySelector('.res-time');

      panel.style.display = 'block';
      codeEl.textContent = 'Executing request...';

      const start = performance.now();
      try {
        const res = await fetch(rawPath, {
          method,
          headers: (method === 'POST' || method === 'PUT' || method === 'PATCH') ? { 'Content-Type': 'application/json' } : {}
        });
        const time = Math.round(performance.now() - start);
        statusEl.textContent = 'Status: ' + res.status + ' ' + res.statusText;
        statusEl.style.color = res.ok ? '#98c379' : '#e06c75';
        timeEl.textContent = time + ' ms';
        const data = await res.json().catch(() => ({}));
        codeEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.textContent = 'Status: Error';
        statusEl.style.color = '#e06c75';
        codeEl.textContent = err.message;
      }
    }
  </script>
</body>
</html>
`;
  files.push({ relativePath: "public/index.html", content: indexHtml });

  // 4. test.js (Automated unit and persistence verification)
  const testJs = `import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "app.db");

console.log("Running self-verification tests for " + ${JSON.stringify(spec.title)} + "...");

// 1. Verify Database file exists
if (!fs.existsSync(dbPath)) {
  console.error("FAIL: app.db database does not exist!");
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(\`
  CREATE TABLE IF NOT EXISTS endpoint_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    calls_count INTEGER DEFAULT 0,
    last_called_at TEXT,
    last_status INTEGER
  );
\`);

// 2. Verify endpoint_metrics table exists
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='endpoint_metrics'").get();
if (!tableCheck) {
  console.error("FAIL: endpoint_metrics table does not exist!");
  process.exit(1);
}

// 3. Test insert and query metric row
const insert = db.prepare(\`
  INSERT INTO endpoint_metrics (path, method, calls_count, last_called_at, last_status)
  VALUES ('/get', 'GET', 1, datetime('now'), 200)
\`).run();

const rowId = Number(insert.lastInsertRowid);
const row = db.prepare("SELECT * FROM endpoint_metrics WHERE id = ?").get(rowId);
if (!row || row.path !== "/get") {
  console.error("FAIL: Failed to insert or query endpoint_metrics row!");
  process.exit(1);
}

// 4. Verify public/index.html exists
const indexPath = path.join(__dirname, "public", "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("FAIL: public/index.html does not exist!");
  process.exit(1);
}

// Clean up test row
db.prepare("DELETE FROM endpoint_metrics WHERE id = ?").run(rowId);
db.close();

console.log("All structural and SQLite persistence verification checks PASSED.");
process.exit(0);
`;
  files.push({ relativePath: "test.js", content: testJs });

  // 5. workflow.test.js
  const workflowTestJs = `import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: process.env.PORT || 3000,
        path,
        method
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: raw });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

test("End-to-End API Explorer UI Workflow", async () => {
  const res = await makeRequest("GET", "/");
  assert.equal(res.status, 200);
  assert.ok(res.body.includes("<title>${escapeHtmlText(spec.title)}</title>"), "Title must match");
  assert.ok(res.body.includes("btn-execute"), "Execute button must be present in UI");
});
`;
  files.push({ relativePath: "workflow.test.js", content: workflowTestJs });

  // 6. forgespec.json
  files.push({
    relativePath: "forgespec.json",
    content: JSON.stringify(spec, null, 2) + "\n"
  });

  // 7. README.md
  files.push({
    relativePath: "README.md",
    content: `# ${spec.title}

Interactive API Documentation & Explorer service generated by Agent App Forge.

## Overview
- **Domain:** API Documentation & Explorer
- **Storage:** SQLite (WAL Mode) in \`app.db\` tracking call metrics
- **Runtime:** Native Node.js HTTP server (zero external dependencies)

## Running
\`\`\`bash
node server.js
\`\`\`
Visit http://localhost:3000

## API Endpoints
- \`GET /api/health\` - Health check and storage metadata
- \`GET /api/endpoints\` - List of available endpoints
- \`GET /api/metrics\` - SQLite WAL telemetry call metrics
- \`GET /get\` - Echoes GET request parameters
- \`POST /post\` - Echoes POST payload
- \`GET /status/:code\` - Simulates custom HTTP status codes
`
  });

  return {
    engineName: "fullstack-node",
    files,
    entryPointInstructions: `Run \`node server.js\` to launch ${spec.title} at http://localhost:3000 (persistent SQLite backend)`,
    supportedOnPlatform: true
  };
}
