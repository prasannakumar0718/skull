import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 49120;
const DB_FILE = path.join(__dirname, "reference.db");

export const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT 'html',
    updatedAt TEXT NOT NULL
  );
`);

// Seed default reference document
const count = db.prepare("SELECT COUNT(*) as count FROM documents").get();
if (count.count === 0) {
  const seed = db.prepare("INSERT INTO documents (title, content, format, updatedAt) VALUES (?, ?, 'html', ?)");
  seed.run("Reference Architecture Guide", "<p>Standard <b>reference</b> document for recreation pilot.</p>", new Date().toISOString());
}

function convertHtmlToMarkdown(html) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const readBody = () => new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });

  if (method === "GET" && pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", app: "reference-document-app", storage: "sqlite" }));
    return;
  }

  if (method === "GET" && pathname === "/api/documents") {
    const docs = db.prepare("SELECT * FROM documents ORDER BY id ASC").all();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(docs));
    return;
  }

  if (method === "POST" && pathname === "/api/documents") {
    const data = await readBody();
    const title = data.title || "Untitled Reference Doc";
    const content = data.content || "<p>Blank reference doc</p>";
    const now = new Date().toISOString();
    const info = db.prepare("INSERT INTO documents (title, content, format, updatedAt) VALUES (?, ?, 'html', ?)").run(title, content, now);
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: Number(info.lastInsertRowid), title, content, format: "html", updatedAt: now }));
    return;
  }

  const patchMatch = pathname.match(/^\/api\/documents\/(\d+)$/);
  if (method === "PATCH" && patchMatch) {
    const id = parseInt(patchMatch[1], 10);
    const data = await readBody();
    const now = new Date().toISOString();
    db.prepare("UPDATE documents SET content = ?, updatedAt = ? WHERE id = ?").run(data.content || "", now, id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id, content: data.content, updatedAt: now }));
    return;
  }

  const exportMatch = pathname.match(/^\/api\/documents\/(\d+)\/export$/);
  if (method === "GET" && exportMatch) {
    const id = parseInt(exportMatch[1], 10);
    const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    if (!doc) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Document not found" }));
      return;
    }
    const format = (parsedUrl.searchParams.get("format") || "html").toLowerCase();
    if (format === "markdown" || format === "md") {
      res.writeHead(200, { "Content-Type": "text/markdown" });
      res.end(`# ${doc.title}\n\n${convertHtmlToMarkdown(doc.content)}\n`);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html><html><body><h1>${doc.title}</h1><div>${doc.content}</div></body></html>`);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[Reference Document App] running on http://localhost:${PORT}`);
});
