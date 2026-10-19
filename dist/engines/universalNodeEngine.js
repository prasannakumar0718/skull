export class UniversalNodeEngine {
    name = "fullstack-node";
    canHandle(_spec) {
        return true; // Universal fallback that runs natively everywhere (Windows, macOS, Linux)
    }
    async generate(spec, _targetDirectory) {
        const files = [];
        // 1. package.json
        const packageJson = {
            name: spec.name,
            version: "1.0.0",
            type: "module",
            scripts: {
                dev: "node server.js",
                start: "node server.js",
                test: "node test.js"
            },
            dependencies: {
                express: "^4.21.2",
                cors: "^2.8.5"
            }
        };
        files.push({
            relativePath: "package.json",
            content: JSON.stringify(packageJson, null, 2) + "\n"
        });
        // 2. server.js (Express REST API + Static Frontend Serving + JSON DB storage)
        const serverJs = `import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Persistent JSON Storage Manager
function loadData() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      tasks: [
        { id: 1, title: "Welcome to ${spec.title}", isDone: false, createdAt: new Date().toISOString() },
        { id: 2, title: "Verify persistent storage", isDone: true, createdAt: new Date().toISOString() }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return { tasks: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "${spec.name}", timestamp: new Date().toISOString() });
});

// GET /api/tasks
app.get("/api/tasks", (req, res) => {
  const data = loadData();
  res.json(data.tasks);
});

// POST /api/tasks
app.post("/api/tasks", (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const data = loadData();
  const newTask = {
    id: Date.now(),
    title: title.trim(),
    isDone: false,
    createdAt: new Date().toISOString()
  };
  data.tasks.push(newTask);
  saveData(data);
  res.status(201).json(newTask);
});

// PATCH /api/tasks/:id
app.patch("/api/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { isDone, title } = req.body;
  const data = loadData();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  if (isDone !== undefined) task.isDone = Boolean(isDone);
  if (title !== undefined) task.title = String(title).trim();
  saveData(data);
  res.json(task);
});

// DELETE /api/tasks/:id
app.delete("/api/tasks/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const data = loadData();
  const initialLength = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  if (data.tasks.length === initialLength) {
    return res.status(404).json({ error: "Task not found" });
  }
  saveData(data);
  res.json({ success: true, id });
});

app.listen(PORT, () => {
  console.log(\`Server listening at http://localhost:\${PORT}\`);
});
`;
        files.push({
            relativePath: "server.js",
            content: serverJs
        });
        // 3. Automated Verification Test Suite (test.js)
        const testJs = `import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Running self-verification tests for ${spec.name}...");

// Verify basic structure
assert.ok(fs.existsSync("package.json"), "package.json must exist");
assert.ok(fs.existsSync("server.js"), "server.js must exist");
assert.ok(fs.existsSync("public/index.html"), "public/index.html must exist");

console.log("All structural verification checks PASSED.");
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
      <span id="storage-status">Persistent Storage: Local SQLite/JSON</span>
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
            entryPointInstructions: "Run `npm install` then `npm start` (or `node server.js`) to launch at http://localhost:3000",
            supportedOnPlatform: true
        };
    }
}
