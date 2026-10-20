import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 49140;
const DB_FILE = path.join(__dirname, "app.db");

// Persistent SQLite Storage Setup with WAL mode
export const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT 'html',
    wordCount INTEGER NOT NULL DEFAULT 0,
    isArchived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documentId INTEGER NOT NULL,
    contentSnapshot TEXT NOT NULL,
    summary TEXT,
    savedAt TEXT NOT NULL
  );
`);

// Seed default document if empty
const countRow = db.prepare("SELECT COUNT(*) AS count FROM documents").get();
if (countRow.count === 0) {
  const seed = db.prepare(`
    INSERT INTO documents (title, content, format, wordCount, isArchived, createdAt, updatedAt)
    VALUES (?, ?, 'html', ?, 0, ?, ?)
  `);
  const now = new Date().toISOString();
  const initContent = "<p>Welcome to <strong>QuickNotes Online</strong>. Start typing to write and format rich documents.</p>";
  seed.run("Welcome to QuickNotes Online", initContent, 12, now, now);
}

function countWords(html) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

function convertHtmlToMarkdown(html) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function convertHtmlToPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
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

  // Health check
  if (method === "GET" && pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", app: "live-mcp-quicknotes-verified", storage: "sqlite", domain: "document-editor", timestamp: new Date().toISOString() }));
    return;
  }

  // GET /api/documents
  if (method === "GET" && pathname === "/api/documents") {
    try {
      const docs = db.prepare("SELECT id, title, format, wordCount, isArchived, createdAt, updatedAt FROM documents WHERE isArchived = 0 ORDER BY id DESC").all();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(docs));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /api/documents
  if (method === "POST" && pathname === "/api/documents") {
    try {
      const data = await readBody();
      const title = (data.title && String(data.title).trim()) ? String(data.title).trim() : "Untitled Document";
      const content = data.content !== undefined ? String(data.content) : "<p>Start writing here...</p>";
      const wordCount = countWords(content);
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO documents (title, content, format, wordCount, isArchived, createdAt, updatedAt)
        VALUES (?, ?, 'html', ?, 0, ?, ?)
      `);
      const info = stmt.run(title, content, wordCount, now, now);
      const id = Number(info.lastInsertRowid);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id, title, content, format: "html", wordCount, createdAt: now, updatedAt: now }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Document specific routes: /api/documents/:id
  const docMatch = pathname.match(/^\/api\/documents\/(\d+)$/);
  if (docMatch) {
    const id = parseInt(docMatch[1], 10);

    // GET /api/documents/:id
    if (method === "GET") {
      const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
      if (!doc) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Document not found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(doc));
      return;
    }

    // PATCH /api/documents/:id (Autosave / Content Update)
    if (method === "PATCH") {
      try {
        const existing = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
        if (!existing) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Document not found" }));
          return;
        }
        const data = await readBody();
        const title = data.title !== undefined ? String(data.title).trim() : existing.title;
        const content = data.content !== undefined ? String(data.content) : existing.content;
        const wordCount = countWords(content);
        const now = new Date().toISOString();

        db.prepare(`
          UPDATE documents SET title = ?, content = ?, wordCount = ?, updatedAt = ? WHERE id = ?
        `).run(title, content, wordCount, now, id);

        // Snapshot revision if content changed
        if (content !== existing.content) {
          db.prepare(`
            INSERT INTO revisions (documentId, contentSnapshot, summary, savedAt)
            VALUES (?, ?, ?, ?)
          `).run(id, content, "Autosave snapshot", now);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id, title, content, wordCount, updatedAt: now }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // DELETE /api/documents/:id
    if (method === "DELETE") {
      const info = db.prepare("DELETE FROM documents WHERE id = ?").run(id);
      if (info.changes === 0) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Document not found" }));
        return;
      }
      db.prepare("DELETE FROM revisions WHERE documentId = ?").run(id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, id }));
      return;
    }
  }

  // GET /api/documents/:id/export?format=html|markdown|text|json
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
      const md = `# ${doc.title}\n\n${convertHtmlToMarkdown(doc.content)}\n`;
      res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
      res.end(md);
      return;
    }

    if (format === "text" || format === "txt") {
      const txt = `${doc.title}\n\n${convertHtmlToPlainText(doc.content)}\n`;
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(txt);
      return;
    }

    if (format === "json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(doc, null, 2));
      return;
    }

    if (format === "doc" || format === "word") {
      const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${doc.title}</title>
</head>
<body>
  <h1>${doc.title}</h1>
  <div>${doc.content}</div>
</body>
</html>`;
      res.writeHead(200, {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.title)}.doc"`
      });
      res.end(wordHtml);
      return;
    }

    // Default HTML export
    const htmlBundle = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    h1 { border-bottom: 2px solid #eaeaea; padding-bottom: 8px; }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  <div class="document-content">
    ${doc.content}
  </div>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(htmlBundle);
    return;
  }

  // Static file serving from public/
  let filePath = path.join(__dirname, "public", pathname === "/" ? "index.html" : pathname.slice(1));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json"
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(fs.readFileSync(filePath));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(PORT, () => {
  console.log(`[Document Studio Server] running at http://localhost:${PORT}`);
});
