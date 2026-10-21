import { ForgeSpec } from "../spec/schema.js";
import { GenerationResult, GeneratedFile } from "./types.js";

function escapeHtmlText(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateContentApp(spec: ForgeSpec): GenerationResult {
  const files: GeneratedFile[] = [];

  const rawHeadings: string[] = Array.isArray(spec.metadata?.observedHeadings) && spec.metadata.observedHeadings.length > 0
    ? spec.metadata.observedHeadings
    : [spec.title || "Example Domain"];

  const rawParagraphs: string[] = Array.isArray(spec.metadata?.observedParagraphs) && spec.metadata.observedParagraphs.length > 0
    ? spec.metadata.observedParagraphs
    : [
        "This domain is established to be used for illustrative examples in documents. You may use this domain in examples without prior coordination or asking for permission."
      ];

  const rawLinks: Array<{ text: string; href: string }> = Array.isArray(spec.metadata?.observedLinks) && spec.metadata.observedLinks.length > 0
    ? spec.metadata.observedLinks
    : [
        { text: "More information...", href: "https://www.iana.org/domains/example" }
      ];

  const headingsJson = JSON.stringify(rawHeadings);
  const paragraphsJson = JSON.stringify(rawParagraphs);
  const linksJson = JSON.stringify(rawLinks);

  // 1. package.json
  files.push({
    relativePath: "package.json",
    content: JSON.stringify(
      {
        name: spec.name || "content-presentation-app",
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
\`);

// Seed initial content row if table is empty
const countRow = db.prepare("SELECT COUNT(*) AS count FROM content_pages").get();
if (Number(countRow.count) === 0) {
  const seed = db.prepare(\`
    INSERT INTO content_pages (title, slug, content, headings, links, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  \`);
  seed.run(
    ${JSON.stringify(spec.title)},
    "/",
    ${JSON.stringify(rawParagraphs.join("\\n\\n"))},
    ${JSON.stringify(headingsJson)},
    ${JSON.stringify(linksJson)}
  );
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
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

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, \`http://\${req.headers.host || "localhost"}\`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health Endpoint
  if (method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      status: "ok",
      title: ${JSON.stringify(spec.title)},
      domain: "content",
      storage: "sqlite-wal"
    });
  }

  // Content REST API
  if (pathname === "/api/content") {
    if (method === "GET") {
      const page = db.prepare("SELECT * FROM content_pages ORDER BY id ASC LIMIT 1").get();
      if (!page) {
        return sendJson(res, 200, {
          title: ${JSON.stringify(spec.title)},
          headings: ${headingsJson},
          paragraphs: ${paragraphsJson},
          links: ${linksJson}
        });
      }
      return sendJson(res, 200, {
        id: page.id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        headings: JSON.parse(page.headings || "[]"),
        links: JSON.parse(page.links || "[]"),
        paragraphs: page.content ? page.content.split("\\n\\n").filter(Boolean) : ${paragraphsJson},
        updated_at: page.updated_at
      });
    }

    if (method === "PATCH") {
      try {
        const body = await parseJsonBody(req);
        const existing = db.prepare("SELECT * FROM content_pages ORDER BY id ASC LIMIT 1").get();
        if (existing) {
          const updatedTitle = body.title !== undefined ? body.title : existing.title;
          const updatedContent = body.content !== undefined ? body.content : existing.content;
          const updatedHeadings = body.headings !== undefined ? JSON.stringify(body.headings) : existing.headings;
          const updatedLinks = body.links !== undefined ? JSON.stringify(body.links) : existing.links;
          db.prepare(\`
            UPDATE content_pages
            SET title = ?, content = ?, headings = ?, links = ?, updated_at = datetime('now')
            WHERE id = ?
          \`).run(updatedTitle, updatedContent, updatedHeadings, updatedLinks, existing.id);
          const updated = db.prepare("SELECT * FROM content_pages WHERE id = ?").get(existing.id);
          return sendJson(res, 200, {
            id: updated.id,
            title: updated.title,
            content: updated.content,
            headings: JSON.parse(updated.headings || "[]"),
            links: JSON.parse(updated.links || "[]"),
            paragraphs: updated.content ? updated.content.split("\\n\\n").filter(Boolean) : [],
            updated_at: updated.updated_at
          });
        } else {
          return sendJson(res, 404, { error: "Content record not found" });
        }
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
  }

  // Serve static HTML
  if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    const indexPath = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  // Fallback 404
  sendJson(res, 404, { error: "Not Found", path: pathname });
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(\`Content presentation service running at http://127.0.0.1:\${PORT}\`);
  });
}

export { server };
`;
  files.push({ relativePath: "server.js", content: serverJs });

  // 3. public/index.html
  const mainH1 = rawHeadings[0] || spec.title;
  const secondaryHeadings = rawHeadings.slice(1);

  const headingsHtml = [
    `<h1>${escapeHtmlText(mainH1)}</h1>`,
    ...secondaryHeadings.map(h => `<h2>${escapeHtmlText(h)}</h2>`)
  ].join("\n    ");

  const paragraphsHtml = rawParagraphs.map(p => `    <p>${escapeHtmlText(p)}</p>`).join("\n");

  const linksHtml = rawLinks.map(l => `    <p><a href="${escapeHtmlText(l.href)}">${escapeHtmlText(l.text || l.href)}</a></p>`).join("\n");

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
      background-color: #f0f0f2;
      font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
      color: #2c3e50;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .content-card {
      width: 100%;
      max-width: 640px;
      padding: 2.5rem;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      border-top: 4px solid #38488f;
    }
    h1 {
      font-size: 2rem;
      font-weight: 600;
      color: #1a252f;
      margin-bottom: 1.25rem;
      line-height: 1.2;
    }
    h2 {
      font-size: 1.35rem;
      font-weight: 500;
      color: #34495e;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }
    p {
      font-size: 1.05rem;
      line-height: 1.65;
      color: #4a5568;
      margin-bottom: 1.25rem;
    }
    a {
      color: #38488f;
      text-decoration: underline;
      font-weight: 500;
      word-break: break-all;
    }
    a:hover {
      color: #202b54;
      text-decoration: none;
    }
    .meta-footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      font-size: 0.85rem;
      color: #718096;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      background: #edf2f7;
      font-size: 0.75rem;
      font-weight: 600;
      color: #4a5568;
    }
    @media (max-width: 480px) {
      body {
        padding: 1rem;
      }
      .content-card {
        padding: 1.5rem;
      }
      h1 {
        font-size: 1.6rem;
      }
    }
  </style>
</head>
<body>
  <main class="content-card">
    ${headingsHtml}
${paragraphsHtml}
${linksHtml}
    <footer class="meta-footer">
      <span class="badge">SQLite WAL Storage</span>
      <span class="badge">Agent App Forge Recreated</span>
    </footer>
  </main>
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
\`);

// 2. Verify content_pages table exists
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='content_pages'").get();
if (!tableCheck) {
  console.error("FAIL: content_pages table does not exist!");
  process.exit(1);
}

// 3. Test insert and query content row
const insert = db.prepare(\`
  INSERT INTO content_pages (title, slug, content, headings, links, created_at, updated_at)
  VALUES ('Test Content Page', '/test', 'Test verification body', '["Test"]', '[]', datetime('now'), datetime('now'))
\`).run();

const rowId = Number(insert.lastInsertRowid);
const row = db.prepare("SELECT * FROM content_pages WHERE id = ?").get(rowId);
if (!row || row.title !== "Test Content Page") {
  console.error("FAIL: Failed to insert or query content_pages row!");
  process.exit(1);
}

// 4. Verify public/index.html exists
const indexPath = path.join(__dirname, "public", "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("FAIL: public/index.html does not exist!");
  process.exit(1);
}

// Clean up test row
db.prepare("DELETE FROM content_pages WHERE id = ?").run(rowId);
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

test("End-to-End Content Presentation Workflow", async () => {
  const res = await makeRequest("GET", "/");
  assert.equal(res.status, 200);
  assert.ok(res.body.includes("${escapeHtmlText(mainH1)}"), "Main heading must be present in HTML");
  assert.ok(res.body.includes("<meta name=\\"viewport\\""), "Viewport meta tag must be present for responsiveness");
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

Recreated content presentation service generated by Agent App Forge.

## Overview
- **Domain:** Content Presentation
- **Storage:** SQLite (WAL Mode) in \`app.db\`
- **Runtime:** Native Node.js HTTP server (zero external dependencies)

## Running
\`\`\`bash
node server.js
\`\`\`
Visit http://localhost:3000

## API Endpoints
- \`GET /api/health\` - Health check and storage metadata
- \`GET /api/content\` - Structured headings, paragraphs, and links
- \`PATCH /api/content\` - Update presentation content
`
  });

  return {
    engineName: "fullstack-node",
    files,
    entryPointInstructions: `Run \`node server.js\` to launch ${spec.title} at http://localhost:3000 (persistent SQLite backend)`,
    supportedOnPlatform: true
  };
}
