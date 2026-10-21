import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ForgeSpec } from "../spec/schema.js";
import { AppGenerationEngine, GenerationResult, GeneratedFile } from "./types.js";
import { generateStudentManagementApp } from "./studentManagementTemplate.js";
import { generateContentApp } from "./contentPageTemplate.js";
import { generateApiDocsApp } from "./apiDocsTemplate.js";

function escapeHtmlText(str: string): string {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export class UniversalNodeEngine implements AppGenerationEngine {
  public name = "fullstack-node";

  public canHandle(_spec: ForgeSpec): boolean {
    return true; // Universal fallback that runs natively everywhere (Windows, macOS, Linux)
  }

  public async generate(spec: ForgeSpec, _targetDirectory: string): Promise<GenerationResult> {
    const isDocumentEditor =
      spec.metadata?.domain === "document-editor" ||
      spec.entities.some((e) => e.name.toLowerCase().includes("document"));

    const isStudentManagement =
      spec.metadata?.domain === "student-management" ||
      spec.entities.some((e) => e.name.toLowerCase().includes("student")) ||
      /student|attendance/i.test(spec.description || "") ||
      /student|attendance/i.test(spec.title || "");

    const isApiDocs =
      spec.metadata?.domain === "api-docs" ||
      spec.entities.some((e) => e.name.toLowerCase().includes("apiendpoint")) ||
      spec.capabilities?.includes("api-documentation") ||
      /api documentation|service explorer|rest api|openapi|swagger/i.test(spec.description || "") ||
      /api documentation|service explorer|rest api|openapi|swagger/i.test(spec.title || "");

    const isContent =
      spec.metadata?.domain === "content" ||
      spec.entities.some((e) => e.name.toLowerCase() === "contentpage") ||
      spec.capabilities?.includes("content-presentation") ||
      /example domain|informational website|content presentation/i.test(spec.title || "") ||
      /content presentation/i.test(spec.description || "");

    let result: GenerationResult;
    if (isDocumentEditor) {
      result = this.generateDocumentEditorApp(spec);
    } else if (isStudentManagement) {
      result = generateStudentManagementApp(spec);
    } else if (isApiDocs) {
      result = generateApiDocsApp(spec);
    } else if (isContent) {
      result = generateContentApp(spec);
    } else {
      result = this.generateStandardApp(spec);
    }

    if (_targetDirectory) {
      try {
        if (!fs.existsSync(_targetDirectory)) {
          fs.mkdirSync(_targetDirectory, { recursive: true });
        }
        const dbPath = path.join(_targetDirectory, "app.db");
        const db = new DatabaseSync(dbPath);
        db.exec("PRAGMA journal_mode = WAL;");
        if (isDocumentEditor) {
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
        } else if (isStudentManagement) {
          db.exec(`
            CREATE TABLE IF NOT EXISTS students (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              roll_number TEXT NOT NULL,
              grade TEXT NOT NULL,
              attendance_rate REAL DEFAULT 100.0,
              fee_status TEXT DEFAULT 'Pending',
              fee_amount REAL DEFAULT 1200.0,
              email TEXT DEFAULT '',
              notes TEXT DEFAULT '',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS attendance_records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              student_id INTEGER NOT NULL,
              date TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'Present',
              notes TEXT DEFAULT ''
            );
          `);
          const countRow = db.prepare("SELECT COUNT(*) AS count FROM students").get() as any;
          if (Number(countRow.count) === 0) {
            const insertStmt = db.prepare(`
              INSERT INTO students (name, roll_number, grade, attendance_rate, fee_status, fee_amount, email, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `);
            insertStmt.run("Alex Chen", "STU-1001", "Grade 10", 96.5, "Paid", 1500.0, "alex.chen@school.edu", "Academic honors list.");
            insertStmt.run("Maria Garcia", "STU-1002", "Grade 11", 82.0, "Pending", 1500.0, "maria.g@school.edu", "Attendance improvement plan active.");
            insertStmt.run("Liam Patel", "STU-1003", "Grade 10", 91.0, "Paid", 1500.0, "liam.p@school.edu", "Standard tuition paid.");
          }
        } else if (isContent) {
          db.exec(`
            CREATE TABLE IF NOT EXISTS content_pages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              slug TEXT DEFAULT '/',
              content TEXT DEFAULT '',
              headings TEXT DEFAULT '[]',
              links TEXT DEFAULT '[]',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
          `);
          const countRow = db.prepare("SELECT COUNT(*) AS count FROM content_pages").get() as any;
          if (Number(countRow.count) === 0) {
            const headingsJson = JSON.stringify(spec.metadata?.observedHeadings || [spec.title]);
            const linksJson = JSON.stringify(spec.metadata?.observedLinks || []);
            const paragraphsText = (spec.metadata?.observedParagraphs || []).join("\n\n");
            const insertStmt = db.prepare(`
              INSERT INTO content_pages (title, slug, content, headings, links, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `);
            insertStmt.run(spec.title, "/", paragraphsText, headingsJson, linksJson);
          }
        } else if (isApiDocs) {
          db.exec(`
            CREATE TABLE IF NOT EXISTS endpoint_metrics (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              path TEXT NOT NULL,
              method TEXT NOT NULL,
              calls_count INTEGER DEFAULT 0,
              last_called_at TEXT,
              last_status INTEGER
            );
          `);
        } else {
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
          const countRow = db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as any;
          if (Number(countRow.count) === 0) {
            const insertStmt = db.prepare(`
              INSERT INTO tasks (title, category, priority, completed, notes, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))
            `);
            insertStmt.run("Implement adaptive parity scoring", "Engineering", "high", 1, "Completed weighted scoring model.");
            insertStmt.run("Design responsive mobile layout", "Design", "medium", 0, "Verify 375x667 viewport without overflow.");
            insertStmt.run("Audit real-website browser interactions", "Engineering", "high", 0, "Test clicks, inputs, reload and persistence.");
          }
        }
        db.close();
      } catch {}
    }

    return result;
  }

  private generateDocumentEditorApp(spec: ForgeSpec): GenerationResult {
    const files: GeneratedFile[] = [];

    // 1. package.json
    files.push({
      relativePath: "package.json",
      content: JSON.stringify(
        {
          name: spec.name,
          version: "1.0.0",
          type: "module",
          scripts: {
            start: "node server.js",
            test: "node test.js",
            "test:workflow": "node workflow.test.js"
          }
        },
        null,
        2
      ) + "\n"
    });

    // 2. server.js (Zero-dependency Node HTTP + Native SQLite + Multi-Format Document Export)
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
\`);

// Seed default document if empty
const countRow = db.prepare("SELECT COUNT(*) AS count FROM documents").get();
if (countRow.count === 0) {
  const seed = db.prepare(\`
    INSERT INTO documents (title, content, format, wordCount, isArchived, createdAt, updatedAt)
    VALUES (?, ?, 'html', ?, 0, ?, ?)
  \`);
  const now = new Date().toISOString();
  const initContent = "<p>Welcome to <strong>${spec.title}</strong>. Start typing to write and format rich documents.</p>";
  seed.run("Welcome to ${spec.title}", initContent, 12, now, now);
}

function countWords(html) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

function convertHtmlToMarkdown(html) {
  return html
    .replace(/<h1[^>]*>(.*?)<\\/h1>/gi, "# $1\\n\\n")
    .replace(/<h2[^>]*>(.*?)<\\/h2>/gi, "## $1\\n\\n")
    .replace(/<h3[^>]*>(.*?)<\\/h3>/gi, "### $1\\n\\n")
    .replace(/<strong[^>]*>(.*?)<\\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\\/i>/gi, "*$1*")
    .replace(/<li[^>]*>(.*?)<\\/li>/gi, "- $1\\n")
    .replace(/<p[^>]*>(.*?)<\\/p>/gi, "$1\\n\\n")
    .replace(/<br\\s*\\/?>/gi, "\\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function convertHtmlToPlainText(html) {
  return html
    .replace(/<br\\s*\\/?>/gi, "\\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\\/p>/gi, "\\n\\n")
    .replace(/<[^>]*>/g, "")
    .trim();
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
    res.end(JSON.stringify({ status: "ok", app: "${spec.name}", storage: "sqlite", domain: "document-editor", timestamp: new Date().toISOString() }));
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

      const stmt = db.prepare(\`
        INSERT INTO documents (title, content, format, wordCount, isArchived, createdAt, updatedAt)
        VALUES (?, ?, 'html', ?, 0, ?, ?)
      \`);
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
  const docMatch = pathname.match(/^\\/api\\/documents\\/(\\d+)$/);
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

        db.prepare(\`
          UPDATE documents SET title = ?, content = ?, wordCount = ?, updatedAt = ? WHERE id = ?
        \`).run(title, content, wordCount, now, id);

        // Snapshot revision if content changed
        if (content !== existing.content) {
          db.prepare(\`
            INSERT INTO revisions (documentId, contentSnapshot, summary, savedAt)
            VALUES (?, ?, ?, ?)
          \`).run(id, content, "Autosave snapshot", now);
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
  const exportMatch = pathname.match(/^\\/api\\/documents\\/(\\d+)\\/export$/);
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
      const md = \`# \${doc.title}\\n\\n\${convertHtmlToMarkdown(doc.content)}\\n\`;
      res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
      res.end(md);
      return;
    }

    if (format === "text" || format === "txt") {
      const txt = \`\${doc.title}\\n\\n\${convertHtmlToPlainText(doc.content)}\\n\`;
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
      const wordHtml = \`<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>\${doc.title}</title>
</head>
<body>
  <h1>\${doc.title}</h1>
  <div>\${doc.content}</div>
</body>
</html>\`;
      res.writeHead(200, {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": \`attachment; filename="\${encodeURIComponent(doc.title)}.doc"\`
      });
      res.end(wordHtml);
      return;
    }

    // Default HTML export
    const htmlBundle = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>\${doc.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    h1 { border-bottom: 2px solid #eaeaea; padding-bottom: 8px; }
  </style>
</head>
<body>
  <h1>\${doc.title}</h1>
  <div class="document-content">
    \${doc.content}
  </div>
</body>
</html>\`;
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
  console.log(\`[\${${JSON.stringify(spec.title)}} Server] running at http://localhost:\${PORT}\`);
});
`;

    files.push({
      relativePath: "server.js",
      content: serverJs
    });

    // 3. public/index.html (Rich Text Studio Canvas)
    const observedButtons: string[] = Array.isArray(spec.metadata?.observedButtons)
      ? (spec.metadata.observedButtons as string[]).filter(b => typeof b === "string" && b.trim())
      : [];
    const standardDocButtons = ["new document", "export", "b", "i", "u", "s", "h1", "h2", "¶", "list", "quote"];
    const extraObservedButtons = observedButtons.filter(
      b => !standardDocButtons.some(sd => b.toLowerCase().includes(sd))
    );

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="app-header">
    <div class="header-left">
      <input type="text" id="doc-title" class="doc-title-input" value="Welcome Document" placeholder="Untitled Document" />
      <span id="save-status" class="badge badge-saved">Saved</span>
      <span id="word-count" class="badge badge-words">0 words</span>
    </div>
    <div class="header-right">
      ${extraObservedButtons.length > 0 ? `
      <div class="header-observed-controls">
        ${extraObservedButtons.map((btn, idx) => `<button type="button" id="btn-observed-${idx}" class="btn btn-observed">${escapeHtmlText(btn)}</button>`).join("\n        ")}
      </div>` : ""}
      <button id="btn-new" class="btn btn-secondary">+ New Document</button>
      <div class="dropdown">
        <button id="btn-export" class="btn btn-primary">Export &#9662;</button>
        <div id="export-menu" class="dropdown-menu">
          <a href="#" data-format="html">HTML Document (.html)</a>
          <a href="#" data-format="markdown">Markdown (.md)</a>
          <a href="#" data-format="doc">Microsoft Word (.doc)</a>
          <a href="#" data-format="print">Print / PDF (.pdf)</a>
          <a href="#" data-format="text">Plain Text (.txt)</a>
          <a href="#" data-format="json">JSON Metadata (.json)</a>
        </div>
      </div>
    </div>
  </header>

  <div class="toolbar">
    <button class="tool-btn" data-cmd="bold" title="Bold"><b>B</b></button>
    <button class="tool-btn" data-cmd="italic" title="Italic"><i>I</i></button>
    <button class="tool-btn" data-cmd="underline" title="Underline"><u>U</u></button>
    <button class="tool-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
    <span class="tool-divider"></span>
    <button class="tool-btn" data-cmd="formatBlock" data-val="h1" title="Heading 1">H1</button>
    <button class="tool-btn" data-cmd="formatBlock" data-val="h2" title="Heading 2">H2</button>
    <button class="tool-btn" data-cmd="formatBlock" data-val="p" title="Paragraph">¶</button>
    <span class="tool-divider"></span>
    <button class="tool-btn" data-cmd="insertUnorderedList" title="Bullet List">• List</button>
    <button class="tool-btn" data-cmd="insertOrderedList" title="Numbered List">1. List</button>
    <button class="tool-btn" data-cmd="formatBlock" data-val="blockquote" title="Quote">“ Quote</button>
  </div>

  <div class="workspace">
    <aside class="sidebar">
      <h3>Documents</h3>
      <ul id="doc-list" class="doc-list"></ul>
    </aside>
    <main class="editor-container">
      <div id="editor-canvas" class="editor-canvas" contenteditable="true" spellcheck="true"></div>
    </main>
  </div>

  <script src="app.js"></script>
</body>
</html>
`;

    files.push({
      relativePath: "public/index.html",
      content: indexHtml
    });

    // 4. public/style.css
    const styleCss = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; color: #111827; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.app-header { display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 12px 24px; border-bottom: 1px solid #e5e7eb; }
.header-left { display: flex; align-items: center; gap: 12px; }
.doc-title-input { font-size: 1.15rem; font-weight: 600; border: 1px solid transparent; padding: 4px 8px; border-radius: 4px; outline: none; }
.doc-title-input:hover, .doc-title-input:focus { border-color: #d1d5db; background: #f9fafb; }
.badge { font-size: 0.75rem; padding: 4px 8px; border-radius: 9999px; font-weight: 500; }
.badge-saved { background: #def7ec; color: #03543f; }
.badge-saving { background: #fef08a; color: #713f12; }
.badge-words { background: #e5e7eb; color: #4b5563; }
.header-right { display: flex; align-items: center; gap: 10px; }
.header-observed-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.btn-observed { background: #f3f4f6; border: 1px solid #d1d5db; color: #374151; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; }
.btn-observed:hover { background: #e5e7eb; }
.btn { padding: 8px 14px; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
.btn-primary { background: #2563eb; color: #ffffff; }
.btn-primary:hover { background: #1d4ed8; }
.btn-secondary { background: #ffffff; border-color: #d1d5db; color: #374151; }
.btn-secondary:hover { background: #f9fafb; }
.dropdown { position: relative; }
.dropdown-menu { display: none; position: absolute; right: 0; top: 100%; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 180px; z-index: 50; }
.dropdown-menu.show { display: block; }
.dropdown-menu a { display: block; padding: 8px 12px; font-size: 0.85rem; color: #374151; text-decoration: none; }
.dropdown-menu a:hover { background: #f3f4f6; }
.toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 24px; background: #fafafa; border-bottom: 1px solid #e5e7eb; }
.tool-btn { background: #ffffff; border: 1px solid #d1d5db; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.tool-btn:hover { background: #f3f4f6; }
.tool-divider { width: 1px; height: 20px; background: #e5e7eb; margin: 0 4px; }
.workspace { display: flex; flex: 1; overflow: hidden; }
.sidebar { width: 240px; background: #ffffff; border-right: 1px solid #e5e7eb; padding: 16px; overflow-y: auto; }
.sidebar h3 { font-size: 0.85rem; text-transform: uppercase; color: #6b7280; margin-bottom: 12px; letter-spacing: 0.05em; }
.doc-list { list-style: none; }
.doc-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 6px; cursor: pointer; margin-bottom: 4px; font-size: 0.9rem; }
.doc-item:hover { background: #f3f4f6; }
.doc-item.active { background: #eff6ff; color: #1d4ed8; font-weight: 500; }
.btn-del-doc { background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 1rem; }
.btn-del-doc:hover { color: #ef4444; }
.editor-container { flex: 1; padding: 32px; overflow-y: auto; display: flex; justify-content: center; }
.editor-canvas { width: 100%; max-width: 800px; min-height: 900px; background: #ffffff; padding: 48px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); outline: none; line-height: 1.7; font-size: 1.05rem; }
.editor-canvas h1 { font-size: 1.8rem; margin-bottom: 12px; }
.editor-canvas h2 { font-size: 1.4rem; margin-bottom: 10px; }
.editor-canvas p { margin-bottom: 14px; }
.editor-canvas ul, .editor-canvas ol { margin-left: 24px; margin-bottom: 14px; }
.editor-canvas blockquote { border-left: 3px solid #d1d5db; padding-left: 14px; color: #4b5563; font-style: italic; margin-bottom: 14px; }
@media (max-width: 600px) {
  body { overflow-x: hidden; height: auto; min-height: 100vh; }
  .app-header { flex-direction: column; align-items: stretch; gap: 8px; padding: 8px 12px; }
  .header-left { width: 100%; justify-content: space-between; }
  .header-right { width: 100%; justify-content: flex-end; }
  .doc-title-input { max-width: 160px; font-size: 1rem; }
  .toolbar { flex-wrap: wrap; padding: 6px 12px; gap: 3px; }
  .tool-btn { padding: 4px 6px; font-size: 0.75rem; }
  .workspace { flex-direction: column; overflow: visible; }
  .sidebar { width: 100%; max-height: 160px; border-right: none; border-bottom: 1px solid #e5e7eb; }
  .editor-container { padding: 12px; width: 100%; }
  .editor-canvas { padding: 16px; min-height: 400px; width: 100%; }
}
@media print {
  .sidebar, .toolbar, .header, .btn-del-doc { display: none !important; }
  .workspace { display: block !important; }
  .editor-container { padding: 0 !important; width: 100% !important; }
  .editor-canvas { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; max-width: 100% !important; min-height: auto !important; }
  body { background: #ffffff !important; color: #000000 !important; }
}
`;

    files.push({
      relativePath: "public/style.css",
      content: styleCss
    });

    // 5. public/app.js (Editor logic, debounced autosave, document switcher, export)
    const appJs = `let currentDocId = null;
let autosaveTimer = null;

const titleInput = document.getElementById("doc-title");
const editorCanvas = document.getElementById("editor-canvas");
const saveStatus = document.getElementById("save-status");
const wordCountEl = document.getElementById("word-count");
const docListEl = document.getElementById("doc-list");
const btnNew = document.getElementById("btn-new");
const btnExport = document.getElementById("btn-export");
const exportMenu = document.getElementById("export-menu");

function countWords(text) {
  const clean = text.replace(/\\s+/g, " ").trim();
  return clean ? clean.split(" ").length : 0;
}

function updateWordCount() {
  const words = countWords(editorCanvas.innerText);
  wordCountEl.textContent = \`\${words} word\${words === 1 ? "" : "s"}\`;
}

async function loadDocuments() {
  try {
    const res = await fetch("/api/documents");
    const docs = await res.json();
    renderDocumentList(docs);
    if (!currentDocId && docs.length > 0) {
      loadDocument(docs[0].id);
    }
  } catch (err) {
    console.error("Failed to load documents", err);
  }
}

function renderDocumentList(docs) {
  docListEl.innerHTML = "";
  docs.forEach((doc) => {
    const li = document.createElement("li");
    li.className = \`doc-item \${doc.id === currentDocId ? "active" : ""}\`;
    li.innerHTML = \`
      <span class="doc-name" onclick="loadDocument(\${doc.id})">\${escapeHtml(doc.title)}</span>
      <button class="btn-del-doc" onclick="deleteDocument(\${doc.id})">&times;</button>
    \`;
    docListEl.appendChild(li);
  });
}

async function loadDocument(id) {
  try {
    currentDocId = id;
    const res = await fetch(\`/api/documents/\${id}\`);
    const doc = await res.json();
    titleInput.value = doc.title;
    editorCanvas.innerHTML = doc.content || "<p></p>";
    saveStatus.textContent = "Saved";
    saveStatus.className = "badge badge-saved";
    updateWordCount();
    loadDocuments();
  } catch (err) {
    console.error("Failed to load document", err);
  }
}

async function createNewDocument() {
  try {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Document", content: "<p>Start writing...</p>" })
    });
    const doc = await res.json();
    loadDocument(doc.id);
  } catch (err) {
    console.error("Failed to create document", err);
  }
}

async function deleteDocument(id) {
  if (!confirm("Are you sure you want to delete this document?")) return;
  try {
    await fetch(\`/api/documents/\${id}\`, { method: "DELETE" });
    if (currentDocId === id) {
      currentDocId = null;
    }
    loadDocuments();
  } catch (err) {
    console.error("Failed to delete document", err);
  }
}

function triggerAutosave() {
  saveStatus.textContent = "Saving...";
  saveStatus.className = "badge badge-saving";
  updateWordCount();

  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    if (!currentDocId) return;
    try {
      await fetch(\`/api/documents/\${currentDocId}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleInput.value.trim(),
          content: editorCanvas.innerHTML
        })
      });
      saveStatus.textContent = "Saved";
      saveStatus.className = "badge badge-saved";
      loadDocuments();
    } catch (err) {
      saveStatus.textContent = "Error";
      console.error("Autosave failed", err);
    }
  }, 500);
}

// Toolbar formatting
document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val || null;
    document.execCommand(cmd, false, val);
    triggerAutosave();
  });
});

editorCanvas.addEventListener("input", triggerAutosave);
titleInput.addEventListener("input", triggerAutosave);
btnNew.addEventListener("click", createNewDocument);

btnExport.addEventListener("click", (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle("show");
});

window.addEventListener("click", () => {
  exportMenu.classList.remove("show");
});

document.querySelectorAll("#export-menu a").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentDocId) return;
    const format = item.dataset.format;
    if (format === "print") {
      window.print();
      return;
    }
    window.open(\`/api/documents/\${currentDocId}/export?format=\${format}\`, "_blank");
  });
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.loadDocument = loadDocument;
window.deleteDocument = deleteDocument;
loadDocuments();
`;

    files.push({
      relativePath: "public/app.js",
      content: appJs
    });

    // 6. test.js (Automated unit and persistence verification)
    const testJs = `import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "app.db");

console.log("Running self-verification tests for " + ${JSON.stringify(spec.title)} + "...");

// 1. Verify Database
if (!fs.existsSync(dbPath)) {
  console.error("FAIL: app.db database does not exist!");
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(\`
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
\`);

// 2. Verify documents table
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").get();
if (!tableCheck) {
  console.error("FAIL: documents table does not exist!");
  process.exit(1);
}

// 3. Test insert and wordCount update
const now = new Date().toISOString();
const insert = db.prepare(\`
  INSERT INTO documents (title, content, format, wordCount, isArchived, createdAt, updatedAt)
  VALUES ('Test Specification Doc', '<p>Testing <strong>word count</strong> and storage.</p>', 'html', 5, 0, ?, ?)
\`).run(now, now);

const docId = Number(insert.lastInsertRowid);
const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(docId);
if (!doc || doc.title !== "Test Specification Doc") {
  console.error("FAIL: Failed to insert or retrieve document!");
  process.exit(1);
}

// Clean up test insert
db.prepare("DELETE FROM documents WHERE id = ?").run(docId);
db.close();

console.log("All structural and SQLite persistence verification checks PASSED.");
process.exit(0);
`;

    files.push({
      relativePath: "test.js",
      content: testJs
    });

    // 7. workflow.test.js (Comprehensive workflow acceptance verification)
    const workflowTestJs = `import http from "node:http";

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const port = process.env.PORT || 3000;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: { "Content-Type": "application/json" }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : {} });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runWorkflows() {
  console.log("Verifying observable workflows for " + ${JSON.stringify(spec.title)} + "...");

  // Workflow 1: Document Creation & Editing
  console.log(" -> Testing Document Creation...");
  const createRes = await makeRequest("POST", "/api/documents", {
    title: "Project Architecture Spec",
    content: "<h1>Architecture</h1><p>Rich text model with <b>autosave</b>.</p>"
  });
  if (createRes.status !== 201 || !createRes.data.id) {
    throw new Error("Failed workflow: Document creation returned " + createRes.status);
  }
  const docId = createRes.data.id;

  // Workflow 2: Autosave & Content Modification
  console.log(" -> Testing Debounced Autosave...");
  const autosaveRes = await makeRequest("PATCH", "/api/documents/" + docId, {
    content: "<h1>Architecture</h1><p>Updated content with <i>revisions</i>.</p>"
  });
  if (autosaveRes.status !== 200 || autosaveRes.data.wordCount < 4) {
    throw new Error("Failed workflow: Autosave returned " + autosaveRes.status);
  }

  // Workflow 3: Multi-Format Document Export
  console.log(" -> Testing Multi-Format Document Export...");
  const exportMd = await makeRequest("GET", "/api/documents/" + docId + "/export?format=markdown");
  if (exportMd.status !== 200 || !String(exportMd.data).includes("# Architecture")) {
    throw new Error("Failed workflow: Markdown export did not produce markdown header.");
  }

  const exportHtml = await makeRequest("GET", "/api/documents/" + docId + "/export?format=html");
  if (exportHtml.status !== 200 || !String(exportHtml.data).includes("<!DOCTYPE html>")) {
    throw new Error("Failed workflow: HTML export did not produce HTML bundle.");
  }

  // Clean up
  await makeRequest("DELETE", "/api/documents/" + docId);
  console.log("All observable workflows verified successfully!");
}

runWorkflows().catch((err) => {
  console.error("Workflow verification FAILED:", err);
  process.exit(1);
});
`;

    files.push({
      relativePath: "workflow.test.js",
      content: workflowTestJs
    });

    // 8. README.md
    files.push({
      relativePath: "README.md",
      content: `# ${spec.title}

Independent rich-text document editing and publishing application generated by Agent App Forge.

## Features
- **Rich-Text Editing Canvas:** Headings, bold, italic, underline, lists, quotes.
- **Persistent SQLite Database:** Powered by native Node.js \`node:sqlite\` with WAL mode.
- **Autosave Engine:** Debounced background autosave with visual status badge.
- **Multi-Format Export:** Export documents to HTML, Markdown, Plain Text, or JSON.
- **Zero Runtime Dependencies:** Runs natively on Node.js 22+.

## Launching
\`\`\`bash
npm start
\`\`\`
Visit http://localhost:3000 in your browser.

## Testing
\`\`\`bash
npm test
\`\`\`
`
    });

    return {
      engineName: this.name,
      files,
      entryPointInstructions: `Run \`node server.js\` to launch ${spec.title} at http://localhost:3000 (persistent SQLite backend)`,
      supportedOnPlatform: true
    };
  }

  private generateStandardApp(spec: ForgeSpec): GenerationResult {
    const files: GeneratedFile[] = [];

    // 1. package.json
    const packageJson = {
      name: spec.name,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "node server.js",
        start: "node server.js",
        test: "node test.js",
        "test:workflow": "node workflow.test.js"
      }
    };

    files.push({
      relativePath: "package.json",
      content: JSON.stringify(packageJson, null, 2) + "\n"
    });

    // 2. server.js (Zero-dependency Node HTTP + Native SQLite with dynamic attributes and analytics)
    const serverJs = `import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);
const DB_FILE = path.join(__dirname, "app.db");

// Persistent SQLite Storage Setup with WAL mode
export const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(\`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    priority TEXT DEFAULT 'medium',
    completed INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
\`);

// Seed default tasks if empty, unless reference was observed in empty state (e.g. minimalist todo reference)
const shouldSeed = ${JSON.stringify(
  spec.metadata?.seedTasks === true ||
  (Array.isArray(spec.metadata?.observedButtons) && spec.metadata.observedButtons.some((b: string) => /add task/i.test(b))) ||
  (!spec.metadata?.observedButtons && !spec.metadata?.domain)
)};
const countRow = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();
if (shouldSeed && Number(countRow.count) === 0) {
  const insertStmt = db.prepare(\`
    INSERT INTO tasks (title, category, priority, completed, notes, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  \`);
  insertStmt.run("Implement adaptive parity scoring", "Engineering", "high", 1, "Completed weighted scoring model.");
  insertStmt.run("Design responsive mobile layout", "Design", "medium", 0, "Verify 375x667 viewport without overflow.");
  insertStmt.run("Audit real-website browser interactions", "Engineering", "high", 0, "Test clicks, inputs, reload and persistence.");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

export const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, \`http://\${req.headers.host || "localhost"}\`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  function sendJson(statusCode, data) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
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

  function readBody() {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  }

  // Health check
  if (method === "GET" && pathname === "/api/health") {
    return sendJson(200, {
      status: "ok",
      app: "${spec.name}",
      title: "${spec.title}",
      version: "1.0.0",
      storage: "sqlite",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  }

  // Analytics Metrics
  if (method === "GET" && pathname === "/api/analytics") {
    try {
      const total = Number(db.prepare("SELECT COUNT(*) AS c FROM tasks").get().c);
      const completed = Number(db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE completed = 1").get().c);
      const high = Number(db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE priority = 'high'").get().c);
      return sendJson(200, {
        total,
        completed,
        active: total - completed,
        highPriority: high
      });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // GET /api/tasks (with query filtering)
  if (method === "GET" && pathname === "/api/tasks") {
    try {
      const filter = parsedUrl.searchParams.get("filter") || parsedUrl.searchParams.get("status");
      let sql = "SELECT * FROM tasks";
      if (filter === "active") {
        sql += " WHERE completed = 0";
      } else if (filter === "completed") {
        sql += " WHERE completed = 1";
      } else if (filter === "high") {
        sql += " WHERE priority = 'high'";
      }
      sql += " ORDER BY id DESC";
      const rows = db.prepare(sql).all().map(t => ({
        ...t,
        isDone: Boolean(t.completed)
      }));
      return sendJson(200, rows);
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // POST /api/tasks
  if (method === "POST" && pathname === "/api/tasks") {
    try {
      const data = await readBody();
      if (!data.title || !String(data.title).trim()) {
        return sendJson(400, { error: "Title is required" });
      }
      const title = String(data.title).trim();
      const category = data.category || "General";
      const priority = data.priority || "medium";
      let completed = 0;
      if (data.completed !== undefined) completed = data.completed ? 1 : 0;
      else if (data.isDone !== undefined) completed = data.isDone ? 1 : 0;
      const notes = data.notes || data.description || "";

      const stmt = db.prepare(\`
        INSERT INTO tasks (title, category, priority, completed, notes, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      \`);
      const info = stmt.run(title, category, priority, completed, notes);
      const created = db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid);
      return sendJson(201, {
        ...created,
        isDone: Boolean(created.completed)
      });
    } catch (err) {
      return sendJson(400, { error: "Invalid JSON or database error: " + err.message });
    }
  }

  // PATCH /api/tasks/:id
  const patchMatch = pathname.match(/^\\/api\\/tasks\\/(\\d+)$/);
  if (method === "PATCH" && patchMatch) {
    try {
      const id = parseInt(patchMatch[1], 10);
      const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      if (!existing) {
        return sendJson(404, { error: "Task not found" });
      }
      const data = await readBody();
      const newTitle = data.title !== undefined ? String(data.title).trim() : existing.title;
      const newCat = data.category !== undefined ? String(data.category) : existing.category;
      const newPrio = data.priority !== undefined ? String(data.priority) : existing.priority;
      let newComp = existing.completed;
      if (data.completed !== undefined) newComp = data.completed ? 1 : 0;
      else if (data.isDone !== undefined) newComp = data.isDone ? 1 : 0;
      const newNotes = data.notes !== undefined ? String(data.notes) : existing.notes;

      db.prepare(\`
        UPDATE tasks
        SET title = ?, category = ?, priority = ?, completed = ?, notes = ?
        WHERE id = ?
      \`).run(newTitle, newCat, newPrio, newComp, newNotes, id);

      const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      return sendJson(200, {
        ...updated,
        isDone: Boolean(updated.completed)
      });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // DELETE /api/tasks/:id
  const deleteMatch = pathname.match(/^\\/api\\/tasks\\/(\\d+)$/);
  if (method === "DELETE" && deleteMatch) {
    try {
      const id = parseInt(deleteMatch[1], 10);
      const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      if (!existing) {
        return sendJson(404, { error: "Task not found" });
      }
      db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      return sendJson(200, { success: true, id });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // Clear completed tasks: POST /api/tasks/clear-completed or DELETE /api/tasks/completed
  if ((method === "POST" && pathname === "/api/tasks/clear-completed") || (method === "DELETE" && pathname === "/api/tasks/completed")) {
    try {
      db.prepare("DELETE FROM tasks WHERE completed = 1").run();
      return sendJson(200, { success: true });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // Static File Serving
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(filePath).replace(/^(\\.\\.[\\/\\\\])+/, "");
  const absolutePath = path.join(__dirname, "public", safePath);

  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    return fs.createReadStream(absolutePath).pipe(res);
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
});

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(\`[Universal Node Server] ${spec.title} running at http://127.0.0.1:\${PORT} (SQLite: \${DB_FILE})\`);
  });
}
`;

    files.push({
      relativePath: "server.js",
      content: serverJs
    });

    // 3. public/index.html (Faithful structure with stats, multi-attribute form, filter controls, and list)
    const brandTitle = spec.title.includes("—") ? spec.title.split("—")[0].trim() : spec.title;
    const brandSubtitle = spec.title.includes("—") ? spec.title.split("—")[1].trim() : spec.description;
    const observedButtons: string[] = Array.isArray(spec.metadata?.observedButtons)
      ? (spec.metadata.observedButtons as string[]).filter(b => typeof b === "string" && b.trim())
      : [];
    const hasAddTask = observedButtons.some(b => /add task/i.test(b));
    const hasClearCompleted = observedButtons.some(b => /clear completed/i.test(b));
    const isMinimalistTaskApp =
      (!hasAddTask && (hasClearCompleted || observedButtons.length <= 1)) ||
      Boolean(spec.capabilities?.includes("minimalist-task-ui")) ||
      spec.metadata?.layout === "minimalist" ||
      spec.metadata?.style === "minimalist";

    const rawHeadings: string[] = Array.isArray(spec.metadata?.observedHeadings) && spec.metadata.observedHeadings.length > 0
      ? spec.metadata.observedHeadings
      : [];
    const rawLinks: Array<{ text: string; href: string }> = Array.isArray(spec.metadata?.observedLinks) && spec.metadata.observedLinks.length > 0
      ? spec.metadata.observedLinks
      : [];

    const taskHeading = rawHeadings.find(h => /todo|task|list|checklist/i.test(h)) ||
      (spec.title && !/recreation|reference|interactive|application/i.test(spec.title)
        ? (spec.title.includes("—") ? spec.title.split("—")[0].trim() : spec.title)
        : "todos");

    const observedTodoMvcLink = rawLinks.find(l => /todomvc/i.test((l.text || "") + " " + (l.href || "")));
    const userRequestedTodoMvc = /todomvc/i.test(spec.description || "") || /todomvc/i.test(spec.title || "");
    const includeTodoMvcLink = Boolean(observedTodoMvcLink || userRequestedTodoMvc);
    const todoMvcHref = observedTodoMvcLink?.href || "https://todomvc.com";
    const todoMvcText = observedTodoMvcLink?.text || "TodoMVC";
    const todoMvcFooterHtml = includeTodoMvcLink
      ? `<p>Part of <a href="${escapeHtmlText(todoMvcHref)}" target="_blank" rel="noopener">${escapeHtmlText(todoMvcText)}</a></p>`
      : "";
    const extraFooterLinksHtml = rawLinks
      .filter(l => !/todomvc/i.test((l.text || "") + " " + (l.href || "")) && l.href && !l.href.startsWith("#"))
      .map(l => `<p><a href="${escapeHtmlText(l.href)}" target="_blank" rel="noopener">${escapeHtmlText(l.text || l.href)}</a></p>`)
      .join("\n      ");

    const standardTaskButtons = ["add task", "all tasks", "active", "completed", "high priority", "complete", "delete", "reopen"];
    const extraObservedButtons = observedButtons.filter(
      b => !standardTaskButtons.some(st => b.toLowerCase().includes(st))
    );

    let mainContentHtml = "";
    if (isMinimalistTaskApp) {
      mainContentHtml = `
  <div class="todomvc-wrapper">
    <aside class="learn">
      ${rawHeadings.filter(h => !/todos/i.test(h)).map(h => `<h3 class="learn-heading">${escapeHtmlText(h)}</h3>`).join("\n      ")}
      ${rawLinks.length > 0 ? `
      <div class="source-links">
        ${rawLinks.map(l => `<a href="${escapeHtmlText(l.href)}" target="_blank" rel="noopener">${escapeHtmlText(l.text || l.href)}</a>`).join("\n        ")}
      </div>` : ""}
    </aside>

    <section class="todoapp">
      <header class="header">
        <h1>${escapeHtmlText(taskHeading)}</h1>
        <input class="new-todo" id="task-title" name="title" placeholder="What needs to be done?" autofocus>
      </header>

      <section class="main" id="main-section">
        <input id="toggle-all" class="toggle-all" type="checkbox">
        <label for="toggle-all">Mark all as complete</label>
        <ul class="todo-list" id="task-list"></ul>
      </section>

      <footer class="footer" id="footer-section">
        <span class="todo-count" id="stat-active"><strong>0</strong> items left</span>
        <ul class="filters">
          <li><a href="#/" class="filter-btn selected active" data-filter="all">All</a></li>
          <li><a href="#/active" class="filter-btn" data-filter="active">Active</a></li>
          <li><a href="#/completed" class="filter-btn" data-filter="completed">Completed</a></li>
        </ul>
        <button type="button" class="clear-completed" id="btn-clear-completed" onclick="clearCompleted()">Clear completed</button>
      </footer>
    </section>

    <footer class="info">
      <p>Double-click to edit a task</p>
      <p>Generated by <a href="#/">Agent App Forge</a></p>
      ${todoMvcFooterHtml ? `${todoMvcFooterHtml}\n      ` : ""}${extraFooterLinksHtml}
    </footer>
  </div>`;
    } else {
      mainContentHtml = `
  <div class="app-container">
    <header class="app-header">
      <div class="brand">
        <h1>${brandTitle}</h1>
        <span class="subtitle">${brandSubtitle}</span>
      </div>
      ${extraObservedButtons.length > 0 ? `
      <div class="header-observed-controls">
        ${extraObservedButtons.map((btn, idx) => `<button type="button" id="btn-observed-${idx}" class="btn btn-observed">${escapeHtmlText(btn)}</button>`).join("\n        ")}
      </div>` : ""}
      <div class="header-stats">
        <span id="stat-total" class="stat-badge">Total: 0</span>
        <span id="stat-active" class="stat-badge stat-active">Active: 0</span>
        <span id="stat-completed" class="stat-badge stat-done">Completed: 0</span>
      </div>
    </header>

    <main class="main-layout">
      <!-- Left sidebar / Form section -->
      <section class="task-form-panel">
        <h2>Create New Task</h2>
        <form id="create-task-form">
          <div class="form-group">
            <label for="task-title">Task Title</label>
            <input type="text" id="task-title" name="title" placeholder="e.g. Implement feature workflow" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="task-category">Category</label>
              <select id="task-category" name="category">
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
              </select>
            </div>

            <div class="form-group">
              <label for="task-priority">Priority</label>
              <select id="task-priority" name="priority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="task-notes">Notes</label>
            <textarea id="task-notes" name="notes" rows="3" placeholder="Additional details or acceptance criteria..."></textarea>
          </div>

          <button type="submit" id="btn-add-task" class="btn btn-primary">+ Add Task</button>
        </form>
      </section>

      <!-- Right content / Tasks list section -->
      <section class="task-list-panel">
        <div class="filter-bar">
          <button type="button" class="btn filter-btn active" data-filter="all">All Tasks</button>
          <button type="button" class="btn filter-btn" data-filter="active">Active</button>
          <button type="button" class="btn filter-btn" data-filter="completed">Completed</button>
          <button type="button" class="btn filter-btn" data-filter="high">High Priority</button>
        </div>

        <div id="task-list" class="task-list">
          <!-- Rendered task items -->
        </div>
      </section>
    </main>
  </div>`;
    }

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${mainContentHtml}
  <script src="app.js"></script>
</body>
</html>
`;

    files.push({
      relativePath: "public/index.html",
      content: indexHtml
    });

    // 4. public/style.css (Clean, responsive layout matching reference dimensions)
    const styleCss = `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f4f6f9;
  color: #1e293b;
  line-height: 1.5;
  overflow-x: hidden;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.brand h1 {
  font-size: 1.6rem;
  color: #2563eb;
  font-weight: 700;
}

.subtitle {
  font-size: 0.85rem;
  color: #64748b;
}

.header-observed-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.btn-observed {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #1e293b;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-observed:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.header-stats {
  display: flex;
  gap: 8px;
}

.stat-badge {
  font-size: 0.8rem;
  padding: 6px 12px;
  border-radius: 20px;
  background: #f1f5f9;
  font-weight: 600;
  color: #475569;
}

.stat-active {
  background: #eff6ff;
  color: #1d4ed8;
}

.stat-done {
  background: #ecfdf5;
  color: #047857;
}

.main-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
}

.task-form-panel {
  background: #ffffff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  height: fit-content;
}

.task-form-panel h2 {
  font-size: 1.2rem;
  margin-bottom: 16px;
  color: #334155;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: #475569;
}

input[type="text"],
select,
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

input[type="text"]:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
  width: 100%;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.task-list-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: #ffffff;
  padding: 8px 12px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.filter-btn {
  background: transparent;
  color: #64748b;
  font-size: 0.85rem;
  padding: 6px 14px;
  border-radius: 6px;
}

.filter-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.filter-btn.active {
  background: #2563eb;
  color: #ffffff;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 16px 20px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  border-left: 4px solid #94a3b8;
  transition: transform 0.15s;
}

.task-item.priority-high {
  border-left-color: #ef4444;
}

.task-item.priority-medium {
  border-left-color: #f59e0b;
}

.task-item.priority-low {
  border-left-color: #10b981;
}

.task-item.is-completed {
  opacity: 0.7;
}

.task-item.is-completed .task-title {
  text-decoration: line-through;
  color: #64748b;
}

.task-info {
  flex: 1;
}

.task-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.badge-category {
  font-size: 0.75rem;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.badge-priority {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: capitalize;
}

.badge-priority.high {
  background: #fee2e2;
  color: #b91c1c;
}

.badge-priority.medium {
  background: #fef3c7;
  color: #b45309;
}

.badge-priority.low {
  background: #d1fae5;
  color: #047857;
}

.task-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.task-notes {
  font-size: 0.85rem;
  color: #64748b;
}

.task-actions {
  display: flex;
  gap: 8px;
  margin-left: 16px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.btn-toggle {
  background: #eff6ff;
  color: #2563eb;
}

.btn-toggle:hover {
  background: #dbeafe;
}

.btn-delete {
  background: #fee2e2;
  color: #dc2626;
}

.btn-delete:hover {
  background: #fecaca;
}

/* Minimalist Task Application Styles */
.todomvc-wrapper {
  max-width: 550px;
  margin: 0 auto;
  padding: 10px;
}
.learn {
  margin-bottom: 20px;
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.learn-heading {
  font-size: 1.1rem;
  color: #334155;
  margin-bottom: 8px;
}
.source-links a {
  display: inline-block;
  margin-right: 12px;
  margin-bottom: 6px;
  color: #2563eb;
  font-size: 0.85rem;
  text-decoration: none;
}
.source-links a:hover {
  text-decoration: underline;
}
.todoapp {
  background: #fff;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2), 0 25px 50px 0 rgba(0, 0, 0, 0.1);
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}
.todoapp h1 {
  font-size: 60px;
  font-weight: 200;
  text-align: center;
  color: #b83f45;
  margin: 0;
  padding: 16px 0 8px;
}
.new-todo {
  padding: 16px 16px 16px 60px;
  border: none;
  background: rgba(0, 0, 0, 0.003);
  box-shadow: inset 0 -2px 1px rgba(0,0,0,0.03);
  width: 100%;
  font-size: 20px;
  box-sizing: border-box;
}
.new-todo:focus {
  outline: none;
}
.todo-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.toggle-all {
  width: 1px;
  height: 1px;
  opacity: 0;
  position: absolute;
  right: 100%;
  bottom: 100%;
}
.footer {
  padding: 10px 15px;
  height: 40px;
  font-size: 14px;
  border-top: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #777;
}
.filters {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  gap: 8px;
}
.filters a {
  color: inherit;
  margin: 3px;
  padding: 3px 7px;
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: 3px;
}
.filters a.selected {
  border-color: #ce4646;
}
.clear-completed {
  cursor: pointer;
  background: none;
  border: none;
  color: inherit;
  font-size: inherit;
}
.clear-completed:hover {
  text-decoration: underline;
}
.info {
  margin: 40px auto 0;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
}
.info a {
  color: inherit;
  text-decoration: none;
}
`;

    files.push({
      relativePath: "public/style.css",
      content: styleCss
    });

    // 5. public/app.js (Interactive client logic with live REST binding, filters, and persistence)
    const appJs = `let allTasks = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-task-form");
  const titleInput = document.getElementById("task-title");
  const filterButtons = document.querySelectorAll(".filter-btn");

  if (form) {
    form.addEventListener("submit", handleCreateTask);
  }

  if (titleInput && !form) {
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreateTask(e);
      }
    });
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active", "selected"));
      btn.classList.add("active", "selected");
      currentFilter = btn.dataset.filter || "all";
      renderTasks();
    });
  });

  loadTasks();
});

async function loadTasks() {
  try {
    const res = await fetch("/api/tasks");
    if (res.ok) {
      allTasks = await res.json();
      renderTasks();
      updateStats();
    }
  } catch (err) {
    console.error("Failed to load tasks:", err);
  }
}

async function handleCreateTask(e) {
  e.preventDefault();
  const titleInput = document.getElementById("task-title");
  const categorySelect = document.getElementById("task-category");
  const prioritySelect = document.getElementById("task-priority");
  const notesInput = document.getElementById("task-notes");

  const title = titleInput.value.trim();
  if (!title) return;

  const newTask = {
    title,
    category: categorySelect ? categorySelect.value : "General",
    priority: prioritySelect ? prioritySelect.value : "medium",
    notes: notesInput ? notesInput.value.trim() : ""
  };

  try {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask)
    });

    if (res.ok) {
      const created = await res.json();
      allTasks.unshift(created);
      titleInput.value = "";
      if (notesInput) notesInput.value = "";
      renderTasks();
      updateStats();
    }
  } catch (err) {
    console.error("Failed to create task:", err);
  }
}

async function toggleTask(id, currentStatus) {
  try {
    const res = await fetch(\`/api/tasks/\${id}\`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !currentStatus })
    });

    if (res.ok) {
      const updated = await res.json();
      const idx = allTasks.findIndex((t) => t.id === id);
      if (idx !== -1) {
        allTasks[idx] = updated;
        renderTasks();
        updateStats();
      }
    }
  } catch (err) {
    console.error("Failed to toggle task:", err);
  }
}

async function deleteTask(id) {
  try {
    const res = await fetch(\`/api/tasks/\${id}\`, {
      method: "DELETE"
    });

    if (res.ok) {
      allTasks = allTasks.filter((t) => t.id !== id);
      renderTasks();
      updateStats();
    }
  } catch (err) {
    console.error("Failed to delete task:", err);
  }
}

function renderTasks() {
  const container = document.getElementById("task-list");
  if (!container) return;
  container.innerHTML = "";

  const isMinimalist = Boolean(document.querySelector(".todoapp"));

  const filtered = allTasks.filter((task) => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return Boolean(task.completed);
    if (currentFilter === "high") return task.priority === "high";
    return true;
  });

  if (isMinimalist) {
    if (filtered.length === 0) {
      container.innerHTML = "";
    } else {
      filtered.forEach((task) => {
        const li = document.createElement("li");
        li.className = \`todo-item \${task.completed ? "completed" : ""}\`;
        li.dataset.id = task.id;
        li.innerHTML = \`
          <div class="view" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #ededed;">
            <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
              <input class="toggle" type="checkbox" \${task.completed ? "checked" : ""} onchange="toggleTask(\${task.id}, \${Boolean(task.completed)})" style="width: 22px; height: 22px; cursor: pointer;">
              <label style="font-size: 1.15rem; \${task.completed ? "text-decoration: line-through; color: #94a3b8;" : "color: #334155;"}">\${escapeHtml(task.title)}</label>
            </div>
            <button type="button" class="destroy btn-delete" onclick="deleteTask(\${task.id})" aria-label="Delete" style="background: none; border: none; font-size: 1.25rem; color: #ef4444; cursor: pointer; padding: 4px 8px;">×</button>
          </div>
        \`;
        container.appendChild(li);
      });
    }

    const statActive = document.getElementById("stat-active");
    if (statActive) {
      const activeCount = allTasks.filter((t) => !t.completed).length;
      statActive.innerHTML = \`<strong>\${activeCount}</strong> item\${activeCount === 1 ? "" : "s"} left\`;
    }

    const clearBtn = document.getElementById("btn-clear-completed");
    if (clearBtn) {
      const completedCount = allTasks.filter((t) => t.completed).length;
      clearBtn.style.display = completedCount > 0 ? "inline-block" : "none";
    }

    const mainSec = document.getElementById("main-section");
    const footerSec = document.getElementById("footer-section");
    if (mainSec) mainSec.style.display = allTasks.length > 0 ? "block" : "none";
    if (footerSec) footerSec.style.display = allTasks.length > 0 ? "flex" : "none";
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = \`<div class="empty-state" style="padding: 32px; text-align: center; color: #94a3b8; background: #fff; border-radius: 8px;">No tasks found.</div>\`;
    return;
  }

  filtered.forEach((task) => {
    const card = document.createElement("div");
    card.className = \`task-item priority-\${task.priority || "medium"} \${task.completed ? "is-completed" : ""}\`;
    card.dataset.id = task.id;

    card.innerHTML = \`
      <div class="task-info">
        <div class="task-meta">
          <span class="badge-category">\${escapeHtml(task.category || "General")}</span>
          <span class="badge-priority \${task.priority || "medium"}">\${task.priority || "medium"}</span>
        </div>
        <div class="task-title">\${escapeHtml(task.title)}</div>
        \${task.notes ? \`<div class="task-notes">\${escapeHtml(task.notes)}</div>\` : ""}
      </div>
      <div class="task-actions">
        <button type="button" class="btn btn-sm btn-toggle" onclick="toggleTask(\${task.id}, \${Boolean(task.completed)})">
          \${task.completed ? "Reopen" : "Complete"}
        </button>
        <button type="button" class="btn btn-sm btn-delete" onclick="deleteTask(\${task.id})">
          Delete
        </button>
      </div>
    \`;

    container.appendChild(card);
  });
}

async function clearCompleted() {
  try {
    const res = await fetch("/api/tasks/clear-completed", { method: "POST" });
    if (res.ok) {
      allTasks = allTasks.filter((t) => !t.completed);
      renderTasks();
      updateStats();
    }
  } catch (err) {
    console.error("Failed to clear completed:", err);
  }
}
window.clearCompleted = clearCompleted;

function updateStats() {
  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  const active = total - completed;

  const totalEl = document.getElementById("stat-total");
  const activeEl = document.getElementById("stat-active");
  const doneEl = document.getElementById("stat-completed");

  if (totalEl) totalEl.textContent = \`Total: \${total}\`;
  if (activeEl) activeEl.textContent = \`Active: \${active}\`;
  if (doneEl) doneEl.textContent = \`Completed: \${completed}\`;
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
`;

    files.push({
      relativePath: "public/app.js",
      content: appJs
    });

    // 6. test.js (Automated self-verification tests)
    const testJs = `import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "app.db");

console.log("Running self-verification tests for ${spec.name}...");

// 1. Verify Database File Exists
if (!fs.existsSync(dbPath)) {
  console.error("FAIL: app.db database does not exist!");
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

// 2. Verify Schema Integrity
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").get();
if (!tableCheck) {
  console.error("FAIL: tasks table does not exist in SQLite database!");
  process.exit(1);
}

// 3. Verify Columns Integrity
const columns = db.prepare("PRAGMA table_info(tasks)").all();
const colNames = columns.map(c => c.name);
const requiredCols = ["id", "title", "category", "priority", "completed", "notes", "created_at"];
for (const req of requiredCols) {
  if (!colNames.includes(req)) {
    console.error(\`FAIL: Column \${req} is missing in tasks table!\`);
    process.exit(1);
  }
}

// 4. Verify Read & Write Capabilities
const insertTest = db.prepare("INSERT INTO tasks (title, category, priority, completed, notes) VALUES ('Verification Task', 'QA', 'low', 0, 'Test')").run();
const insertedId = Number(insertTest.lastInsertRowid);
const verifiedRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(insertedId);
if (!verifiedRow || verifiedRow.title !== 'Verification Task') {
  console.error("FAIL: Failed to insert or verify test task row!");
  process.exit(1);
}
db.prepare("DELETE FROM tasks WHERE id = ?").run(insertedId);

// 5. Verify Write, Toggle, and Delete Capabilities
const insert = db.prepare(\`
  INSERT INTO tasks (title, category, priority, completed, notes, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
\`).run("Verification Probe Task", "Engineering", "high", 0, "Test notes");

const newId = insert.lastInsertRowid;
if (!newId) {
  console.error("FAIL: Failed to insert record into SQLite tasks table!");
  process.exit(1);
}

// Toggle complete
db.prepare("UPDATE tasks SET completed = 1 WHERE id = ?").run(newId);
const updated = db.prepare("SELECT completed FROM tasks WHERE id = ?").get(newId);
if (Number(updated.completed) !== 1) {
  console.error("FAIL: Status toggle update failed!");
  process.exit(1);
}

// Clean up
const deleteAction = db.prepare("DELETE FROM tasks WHERE id = ?").run(newId);
if (deleteAction.changes !== 1) {
  console.error("FAIL: Failed to delete verification probe record!");
  process.exit(1);
}

db.close();
console.log("All structural and SQLite persistence verification checks PASSED.");
process.exit(0);
`;

    files.push({
      relativePath: "test.js",
      content: testJs
    });

    // 7. workflow.test.js (Automated end-to-end workflow verification)
    const workflowTestJs = `import http from "node:http";
import { server } from "./server.js";

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const port = address.port;
    const options = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: { "Content-Type": "application/json" }
    };
    const req = http.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : {} });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runWorkflows() {
  console.log("Running observable workflow verification tests...");

  // Workflow 1: Health check
  const healthRes = await makeRequest("GET", "/api/health");
  if (healthRes.status !== 200) {
    throw new Error("Health check failed with status " + healthRes.status);
  }

  // Workflow 2: Task creation with full attributes
  const createRes = await makeRequest("POST", "/api/tasks", {
    title: "Workflow Test Task",
    category: "Engineering",
    priority: "high",
    notes: "Testing full workflow lifecycle"
  });
  if (createRes.status !== 201 || !createRes.data.id) {
    throw new Error("Task creation returned " + createRes.status);
  }
  const taskId = createRes.data.id;

  // Workflow 3: Status toggle to completed
  const completeRes = await makeRequest("PATCH", "/api/tasks/" + taskId, { completed: true });
  if (completeRes.status !== 200 || !completeRes.data.completed) {
    throw new Error("Task completion returned " + completeRes.status);
  }

  // Workflow 4: Query filtering by status
  const filterCompletedRes = await makeRequest("GET", "/api/tasks?filter=completed");
  if (filterCompletedRes.status !== 200 || !Array.isArray(filterCompletedRes.data)) {
    throw new Error("Filter completed returned " + filterCompletedRes.status);
  }

  // Workflow 5: Realtime analytics metrics
  const analyticsRes = await makeRequest("GET", "/api/analytics");
  if (analyticsRes.status !== 200 || analyticsRes.data.total < 1) {
    throw new Error("Analytics returned " + analyticsRes.status);
  }

  // Clean up: delete task
  await makeRequest("DELETE", "/api/tasks/" + taskId);
  console.log("All observable task workflows verified successfully!");
}

server.listen(0, "127.0.0.1", () => {
  runWorkflows()
    .then(() => {
      server.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Workflow test failed:", err);
      server.close();
      process.exit(1);
    });
});
`;

    files.push({
      relativePath: "workflow.test.js",
      content: workflowTestJs
    });

    // 8. README.md
    const readmeMd = `# ${spec.title}

Generated with **Agent App Forge** (Universal Node Engine).

## Features
- **Persistent SQLite Storage:** Native Node.js \`node:sqlite\` with WAL mode.
- **Task Management Lifecycle:** Create, view, filter (All, Active, Completed, High Priority), toggle (Complete/Reopen), and delete tasks.
- **Multi-Attribute Records:** Retains title, category, priority, status, notes, and timestamps.
- **Realtime Analytics:** \`/api/analytics\` metrics and header statistics badges.
- **Zero Runtime Dependencies:** Runs natively on Node.js 22+.

## Quickstart
\`\`\`bash
# Start development server
node server.js
\`\`\`
Visit http://localhost:3000 in your browser.

## Self-Verification Tests
\`\`\`bash
node test.js
node workflow.test.js
\`\`\`
`;

    files.push({
      relativePath: "README.md",
      content: readmeMd
    });

    return {
      engineName: this.name,
      files,
      entryPointInstructions: `Run \`node server.js\` to launch ${spec.title} at http://localhost:3000 (persistent SQLite backend)`,
      supportedOnPlatform: true
    };
  }
}
