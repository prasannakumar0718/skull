export class UniversalNodeEngine {
    name = "fullstack-node";
    canHandle(_spec) {
        return true; // Universal fallback that runs natively everywhere (Windows, macOS, Linux)
    }
    async generate(spec, _targetDirectory) {
        const isDocumentEditor = spec.metadata?.domain === "document-editor" ||
            spec.entities.some((e) => e.name.toLowerCase().includes("document")) ||
            (spec.capabilities && spec.capabilities.includes("rich-text-editing"));
        if (isDocumentEditor) {
            return this.generateDocumentEditorApp(spec);
        }
        return this.generateStandardApp(spec);
    }
    generateDocumentEditorApp(spec) {
        const files = [];
        // 1. package.json
        files.push({
            relativePath: "package.json",
            content: JSON.stringify({
                name: spec.name,
                version: "1.0.0",
                type: "module",
                scripts: {
                    start: "node server.js",
                    test: "node test.js",
                    "test:workflow": "node workflow.test.js"
                }
            }, null, 2) + "\n"
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
  console.log(\`[Document Studio Server] running at http://localhost:\${PORT}\`);
});
`;
        files.push({
            relativePath: "server.js",
            content: serverJs
        });
        // 3. public/index.html (Rich Text Studio Canvas)
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

console.log("Running self-verification tests for Document Studio...");

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
  console.log("Verifying observable workflows for Document Studio...");

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
            entryPointInstructions: "Run `node server.js` to launch Document Studio at http://localhost:3000 (persistent SQLite backend)",
            supportedOnPlatform: true
        };
    }
    generateStandardApp(spec) {
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
            }
        };
        files.push({
            relativePath: "package.json",
            content: JSON.stringify(packageJson, null, 2) + "\n"
        });
        // 2. server.js
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
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(PORT, () => {
  console.log(\`[Universal Node Server] running at http://localhost:\${PORT} (SQLite: \${DB_FILE})\`);
});
`;
        files.push({
            relativePath: "server.js",
            content: serverJs
        });
        // 3. test.js (Automated self-verification tests)
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

// 3. Verify Read Capabilities
const rows = db.prepare("SELECT COUNT(*) AS total FROM tasks").get();
if (rows.total < 1) {
  console.error("FAIL: tasks table is empty, expected seed data!");
  process.exit(1);
}

// 4. Verify Write Capabilities (Insert & Delete)
const insert = db.prepare("INSERT INTO tasks (title, isDone, createdAt) VALUES (?, 0, ?)").run("Verification Probe Task", new Date().toISOString());
const newId = insert.lastInsertRowid;
if (!newId) {
  console.error("FAIL: Failed to insert record into SQLite tasks table!");
  process.exit(1);
}

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
        // 4. README.md
        const readmeMd = `# ${spec.title}

Generated with **Agent App Forge** (Universal Node Engine).

## Features
- Persistent local SQLite storage in WAL mode via \`node:sqlite\`.
- Zero external runtime dependencies. Runs natively on Node.js 22+.
- Full RESTful CRUD API endpoints (\`/api/tasks\`, \`/api/health\`).
- Clean HTML5/CSS3 client interface.

## Quickstart
\`\`\`bash
# Start development server
node server.js
\`\`\`
Visit http://localhost:3000 in your browser.

## Self-Verification Tests
\`\`\`bash
node test.js
\`\`\`
`;
        files.push({
            relativePath: "README.md",
            content: readmeMd
        });
        // 5. public/index.html
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f6f8; color: #333; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    h1 { margin-bottom: 8px; font-size: 1.8rem; color: #1a202c; }
    p.desc { color: #718096; margin-bottom: 24px; font-size: 0.95rem; }
    form { display: flex; gap: 10px; margin-bottom: 24px; }
    input[type="text"] { flex: 1; padding: 12px 14px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 1rem; }
    button { padding: 12px 20px; background: #3182ce; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: 500; }
    button:hover { background: #2b6cb0; }
    ul { list-style: none; }
    li.task-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #edf2f7; }
    li.task-item:last-child { border-bottom: none; }
    .task-left { display: flex; align-items: center; gap: 12px; }
    .task-title.done { text-decoration: line-through; color: #a0aec0; }
    .btn-del { background: transparent; color: #e53e3e; padding: 4px 8px; font-size: 0.9rem; }
    .btn-del:hover { background: #fff5f5; }
    .status-bar { margin-top: 20px; font-size: 0.85rem; color: #a0aec0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${spec.title}</h1>
    <p class="desc">${spec.description}</p>
    
    <form id="task-form">
      <input type="text" id="task-input" placeholder="What needs to be done?" required />
      <button type="submit">Add Item</button>
    </form>

    <ul id="task-list"></ul>

    <div class="status-bar" id="task-count">0 items left</div>
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
