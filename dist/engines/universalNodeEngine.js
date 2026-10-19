export class UniversalNodeEngine {
    name = "fullstack-node";
    canHandle(_spec) {
        return true; // Universal fallback that runs natively everywhere (Windows, macOS, Linux)
    }
    async generate(spec, _targetDirectory) {
        const files = [];
        // 1. package.json (Zero external dependencies required - runs natively on Node 22+)
        const packageJson = {
            name: spec.name,
            version: "1.0.0",
            type: "module",
            scripts: {
                dev: "node server.js",
                start: "node server.js",
                test: "node test.js"
            }
        };
        files.push({
            relativePath: "package.json",
            content: JSON.stringify(packageJson, null, 2) + "\n"
        });
        // 2. server.js (Zero-dependency Node HTTP + Native SQLite DB storage)
        const serverJs = `import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "app.db");

// Persistent SQLite Storage Setup with WAL mode
export const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(\`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    isDone INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
\`);

// Seed default tasks if empty
const countRow = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();
if (countRow.count === 0) {
  const seed = db.prepare("INSERT INTO tasks (title, isDone, createdAt) VALUES (?, ?, ?)");
  seed.run("Welcome to ${spec.title}", 0, new Date().toISOString());
  seed.run("Verify persistent SQLite storage", 1, new Date().toISOString());
}

export const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, \`http://\${req.headers.host || "localhost"}\`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (method === "GET" && pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", app: "${spec.name}", storage: "sqlite", timestamp: new Date().toISOString() }));
    return;
  }

  // GET /api/tasks
  if (method === "GET" && pathname === "/api/tasks") {
    try {
      const tasks = db.prepare("SELECT id, title, (isDone = 1) AS isDone, createdAt FROM tasks ORDER BY id ASC").all();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tasks));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Helper to read JSON request body
  const readBody = () => new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

  // POST /api/tasks
  if (method === "POST" && pathname === "/api/tasks") {
    try {
      const data = await readBody();
      if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Title is required" }));
        return;
      }
      const createdAt = new Date().toISOString();
      const info = db.prepare("INSERT INTO tasks (title, isDone, createdAt) VALUES (?, 0, ?)").run(data.title.trim(), createdAt);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: Number(info.lastInsertRowid), title: data.title.trim(), isDone: false, createdAt }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON or database error" }));
    }
    return;
  }

  // PATCH /api/tasks/:id
  const patchMatch = pathname.match(/^\\/api\\/tasks\\/(\\d+)$/);
  if (method === "PATCH" && patchMatch) {
    try {
      const id = parseInt(patchMatch[1], 10);
      const existing = db.prepare("SELECT id, title, (isDone = 1) AS isDone, createdAt FROM tasks WHERE id = ?").get(id);
      if (!existing) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Task not found" }));
        return;
      }
      const data = await readBody();
      const isDoneVal = data.isDone !== undefined ? (data.isDone ? 1 : 0) : (existing.isDone ? 1 : 0);
      const titleVal = data.title !== undefined ? String(data.title).trim() : existing.title;
      db.prepare("UPDATE tasks SET title = ?, isDone = ? WHERE id = ?").run(titleVal, isDoneVal, id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id, title: titleVal, isDone: Boolean(isDoneVal), createdAt: existing.createdAt }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // DELETE /api/tasks/:id
  const deleteMatch = pathname.match(/^\\/api\\/tasks\\/(\\d+)$/);
  if (method === "DELETE" && deleteMatch) {
    try {
      const id = parseInt(deleteMatch[1], 10);
      const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      if (info.changes === 0) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Task not found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, id }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static file serving: public/index.html
  if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    const htmlPath = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(\`Server listening at http://localhost:\${PORT}\`);
  });
}
`;
        files.push({
            relativePath: "server.js",
            content: serverJs
        });
        // 3. Automated Verification Test Suite (test.js)
        const testJs = `import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

console.log("Running self-verification tests for ${spec.name}...");

// 1. Structural check
assert.ok(fs.existsSync("package.json"), "package.json must exist");
assert.ok(fs.existsSync("server.js"), "server.js must exist");
assert.ok(fs.existsSync("public/index.html"), "public/index.html must exist");

// 2. Persistent SQLite Storage Verification
const db = new DatabaseSync("app.db");
try {
  db.exec("PRAGMA journal_mode = WAL;");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").all();
  assert.ok(tables.length > 0, "tasks table must exist in SQLite database");

  // Test transaction: Insert, Query, Update, Delete
  const insertStmt = db.prepare("INSERT INTO tasks (title, isDone, createdAt) VALUES (?, ?, ?)");
  const info = insertStmt.run("Self-test verification task", 0, new Date().toISOString());
  assert.ok(info.lastInsertRowid > 0, "Insert transaction must succeed");

  const selectStmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  const record = selectStmt.get(info.lastInsertRowid);
  assert.equal(record.title, "Self-test verification task", "Read-back must match inserted record");

  const deleteStmt = db.prepare("DELETE FROM tasks WHERE id = ?");
  deleteStmt.run(info.lastInsertRowid);
} finally {
  db.close();
}

console.log("All structural and SQLite persistence verification checks PASSED.");
`;
        files.push({
            relativePath: "test.js",
            content: testJs
        });
        // 4. public/index.html (Rich Interactive Frontend)
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.title}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
      --danger: #ef4444;
      --success: #22c55e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 16px; }
    .container { width: 100%; max-width: 560px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { font-size: 24px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
    p.desc { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
    form { display: flex; gap: 8px; margin-bottom: 24px; }
    input[type="text"] { flex: 1; background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; color: var(--text); font-size: 14px; outline: none; }
    input[type="text"]:focus { border-color: var(--accent); }
    button.btn-add { background: var(--accent); color: #0f172a; border: none; font-weight: 700; border-radius: 8px; padding: 12px 20px; cursor: pointer; transition: background 0.15s; }
    button.btn-add:hover { background: var(--accent-hover); }
    ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    li.task-item { display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid var(--border); padding: 12px 14px; border-radius: 10px; transition: border-color 0.15s; }
    li.task-item:hover { border-color: #475569; }
    .task-left { display: flex; align-items: center; gap: 12px; flex: 1; }
    input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer; }
    span.task-title { font-size: 14px; color: var(--text); }
    span.task-title.done { text-decoration: line-through; color: var(--muted); }
    button.btn-del { background: none; border: none; color: #64748b; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 4px; }
    button.btn-del:hover { color: var(--danger); }
    .status-bar { margin-top: 20px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${spec.title}</h1>
    <p class="desc">${spec.description}</p>

    <form id="task-form">
      <input type="text" id="task-input" placeholder="What needs to be done?" required autocomplete="off" />
      <button type="submit" class="btn-add">Add Task</button>
    </form>

    <ul id="task-list"></ul>

    <div class="status-bar">
      <span id="task-count">0 tasks</span>
      <span id="storage-status">Persistent Storage: SQLite (WAL Mode)</span>
    </div>
  </div>

  <script>
    const form = document.getElementById("task-form");
    const input = document.getElementById("task-input");
    const list = document.getElementById("task-list");
    const countEl = document.getElementById("task-count");

    async function loadTasks() {
      try {
        const res = await fetch("/api/tasks");
        const tasks = await res.json();
        renderTasks(tasks);
      } catch (err) {
        console.error("Failed to load tasks", err);
      }
    }

    function renderTasks(tasks) {
      list.innerHTML = "";
      tasks.forEach((task) => {
        const li = document.createElement("li");
        li.className = "task-item";
        li.innerHTML = \`
          <div class="task-left">
            <input type="checkbox" \${task.isDone ? "checked" : ""} onchange="toggleTask(\${task.id}, \${!task.isDone})" />
            <span class="task-title \${task.isDone ? "done" : ""}">\${escapeHtml(task.title)}</span>
          </div>
          <button class="btn-del" onclick="deleteTask(\${task.id})">&times;</button>
        \`;
        list.appendChild(li);
      });
      const remaining = tasks.filter((t) => !t.isDone).length;
      countEl.textContent = \`\${remaining} item\${remaining === 1 ? "" : "s"} left\`;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      input.value = "";
      loadTasks();
    });

    window.toggleTask = async (id, isDone) => {
      await fetch(\`/api/tasks/\${id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone })
      });
      loadTasks();
    };

    window.deleteTask = async (id) => {
      await fetch(\`/api/tasks/\${id}\`, { method: "DELETE" });
      loadTasks();
    };

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    loadTasks();
  </script>
</body>
</html>
`;
        files.push({
            relativePath: "public/index.html",
            content: indexHtml
        });
        return {
            engineName: this.name,
            files,
            entryPointInstructions: "Run `node server.js` to launch at http://localhost:3000 (persistent SQLite backend)",
            supportedOnPlatform: true
        };
    }
}
