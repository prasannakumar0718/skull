import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "49150", 10);
const DB_PATH = path.join(__dirname, "app.db");

// Initialize Database
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    priority TEXT DEFAULT 'medium',
    completed INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial tasks if empty
const countRow = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();
if (Number(countRow.count) === 0) {
  const insertStmt = db.prepare(`
    INSERT INTO tasks (title, category, priority, completed, notes, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  insertStmt.run("Implement adaptive parity scoring", "Engineering", "high", 1, "Completed weighted scoring model.");
  insertStmt.run("Design responsive mobile layout", "Design", "medium", 0, "Verify 375x667 viewport without overflow.");
  insertStmt.run("Audit real-website browser interactions", "Engineering", "high", 0, "Test clicks, inputs, reload and persistence.");
}

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png"
};

export const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  function sendJson(status, data) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(JSON.stringify(data));
  }

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  // REST API Routes
  if (pathname === "/api/health" && method === "GET") {
    return sendJson(200, {
      status: "ok",
      app: "TaskFlow",
      version: "1.0.0",
      database: "connected",
      storage: "sqlite-wal"
    });
  }

  if (pathname === "/api/tasks" && method === "GET") {
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY id DESC").all();
    return sendJson(200, tasks);
  }

  if (pathname === "/api/tasks" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        if (!payload.title || !payload.title.trim()) {
          return sendJson(400, { error: "Title is required" });
        }
        const stmt = db.prepare(`
          INSERT INTO tasks (title, category, priority, completed, notes, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);
        const info = stmt.run(
          payload.title.trim(),
          payload.category || "General",
          payload.priority || "medium",
          payload.completed ? 1 : 0,
          payload.notes || ""
        );
        const created = db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid);
        return sendJson(201, created);
      } catch (err) {
        return sendJson(400, { error: "Invalid JSON body" });
      }
    });
    return;
  }

  if (pathname.startsWith("/api/tasks/") && method === "PATCH") {
    const id = parseInt(pathname.split("/")[3], 10);
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
        if (!existing) return sendJson(404, { error: "Task not found" });

        const newTitle = payload.title !== undefined ? payload.title : existing.title;
        const newCategory = payload.category !== undefined ? payload.category : existing.category;
        const newPriority = payload.priority !== undefined ? payload.priority : existing.priority;
        const newCompleted = payload.completed !== undefined ? (payload.completed ? 1 : 0) : existing.completed;
        const newNotes = payload.notes !== undefined ? payload.notes : existing.notes;

        db.prepare(`
          UPDATE tasks
          SET title = ?, category = ?, priority = ?, completed = ?, notes = ?
          WHERE id = ?
        `).run(newTitle, newCategory, newPriority, newCompleted, newNotes, id);

        const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
        return sendJson(200, updated);
      } catch (err) {
        return sendJson(400, { error: "Invalid JSON body" });
      }
    });
    return;
  }

  if (pathname.startsWith("/api/tasks/") && method === "DELETE") {
    const id = parseInt(pathname.split("/")[3], 10);
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!existing) return sendJson(404, { error: "Task not found" });

    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return sendJson(200, { success: true, deletedId: id });
  }

  if (pathname === "/api/analytics" && method === "GET") {
    const total = Number(db.prepare("SELECT COUNT(*) AS c FROM tasks").get().c);
    const completed = Number(db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE completed = 1").get().c);
    const high = Number(db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE priority = 'high'").get().c);
    return sendJson(200, {
      total,
      completed,
      active: total - completed,
      highPriority: high
    });
  }

  // Static File Serving
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
  const absolutePath = path.join(__dirname, "public", safePath);

  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    return fs.createReadStream(absolutePath).pipe(res);
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`TaskFlow Reference running at http://127.0.0.1:${PORT}`);
  });
}
