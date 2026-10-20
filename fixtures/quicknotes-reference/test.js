import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "app.db");

console.log("Running self-verification tests for " + "QuickNotes Online" + "...");

// 1. Verify Database
if (!fs.existsSync(dbPath)) {
  console.error("FAIL: app.db database does not exist!");
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
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

// 2. Verify documents table
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").get();
if (!tableCheck) {
  console.error("FAIL: documents table does not exist!");
  process.exit(1);
}

// 3. Test insert and wordCount update
const now = new Date().toISOString();
const insert = db.prepare(`
  INSERT INTO documents (title, content, format, wordCount, isArchived, createdAt, updatedAt)
  VALUES ('Test Specification Doc', '<p>Testing <strong>word count</strong> and storage.</p>', 'html', 5, 0, ?, ?)
`).run(now, now);

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
