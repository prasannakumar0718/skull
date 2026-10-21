import { ForgeSpec } from "../spec/schema.js";
import { GenerationResult, GeneratedFile } from "./types.js";

function escapeHtmlText(str: string): string {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateStudentManagementApp(spec: ForgeSpec): GenerationResult {
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
\`);

// Seed default students if empty
const countRow = db.prepare("SELECT COUNT(*) AS count FROM students").get();
if (Number(countRow.count) === 0) {
  const insertStmt = db.prepare(\`
    INSERT INTO students (name, roll_number, grade, attendance_rate, fee_status, fee_amount, email, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  \`);
  insertStmt.run("Alex Chen", "STU-1001", "Grade 10", 96.5, "Paid", 1500.0, "alex.chen@school.edu", "Academic honors list.");
  insertStmt.run("Maria Garcia", "STU-1002", "Grade 11", 82.0, "Pending", 1500.0, "maria.g@school.edu", "Attendance improvement plan active.");
  insertStmt.run("Liam Patel", "STU-1003", "Grade 10", 91.0, "Paid", 1500.0, "liam.p@school.edu", "Standard tuition paid.");
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

  // 1. Health endpoint
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

  // 2. Analytics / Overview KPIs
  if (method === "GET" && pathname === "/api/analytics") {
    try {
      const total = Number(db.prepare("SELECT COUNT(*) AS c FROM students").get().c);
      const paid = Number(db.prepare("SELECT COUNT(*) AS c FROM students WHERE LOWER(fee_status) = 'paid'").get().c);
      const pending = Number(db.prepare("SELECT COUNT(*) AS c FROM students WHERE LOWER(fee_status) != 'paid'").get().c);
      const avgRow = db.prepare("SELECT AVG(attendance_rate) AS avg_att FROM students").get();
      const avgAttendance = avgRow && avgRow.avg_att !== null ? Math.round(Number(avgRow.avg_att) * 10) / 10 : 100.0;
      const feesPaidRow = db.prepare("SELECT SUM(fee_amount) AS sum_paid FROM students WHERE LOWER(fee_status) = 'paid'").get();
      const feesPendingRow = db.prepare("SELECT SUM(fee_amount) AS sum_pending FROM students WHERE LOWER(fee_status) != 'paid'").get();

      return sendJson(200, {
        totalStudents: total,
        averageAttendance: avgAttendance,
        paidCount: paid,
        pendingCount: pending,
        totalFeesCollected: Number(feesPaidRow.sum_paid || 0),
        totalFeesPending: Number(feesPendingRow.sum_pending || 0)
      });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // 3. GET /api/students
  if (method === "GET" && pathname === "/api/students") {
    try {
      const feeStatus = parsedUrl.searchParams.get("feeStatus");
      const grade = parsedUrl.searchParams.get("grade");
      const filter = parsedUrl.searchParams.get("filter");
      const search = parsedUrl.searchParams.get("search");

      let sql = "SELECT * FROM students WHERE 1=1";
      const params = [];

      if (feeStatus) {
        sql += " AND LOWER(fee_status) = LOWER(?)";
        params.push(feeStatus);
      }
      if (grade) {
        sql += " AND grade = ?";
        params.push(grade);
      }
      if (filter === "low-attendance") {
        sql += " AND attendance_rate < 85.0";
      } else if (filter === "paid") {
        sql += " AND LOWER(fee_status) = 'paid'";
      } else if (filter === "pending") {
        sql += " AND LOWER(fee_status) != 'paid'";
      }
      if (search) {
        sql += " AND (name LIKE ? OR roll_number LIKE ?)";
        params.push(\`%\${search}%\`, \`%\${search}%\`);
      }

      sql += " ORDER BY id DESC";
      const rows = db.prepare(sql).all(...params);
      return sendJson(200, rows);
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // 4. POST /api/students
  if (method === "POST" && pathname === "/api/students") {
    try {
      const data = await readBody();
      if (!data.name || !String(data.name).trim()) {
        return sendJson(400, { error: "Student name is required" });
      }
      const name = String(data.name).trim();
      const rollNumber = String(data.rollNumber || data.roll_number || ("STU-" + Math.floor(1000 + Math.random() * 9000))).trim();
      const grade = String(data.grade || "Grade 10").trim();
      const attendanceRate = data.attendanceRate !== undefined ? Number(data.attendanceRate) : (data.attendance_rate !== undefined ? Number(data.attendance_rate) : 100.0);
      const feeStatus = String(data.feeStatus || data.fee_status || "Pending").trim();
      const feeAmount = data.feeAmount !== undefined ? Number(data.feeAmount) : (data.fee_amount !== undefined ? Number(data.fee_amount) : 1200.0);
      const email = String(data.email || "").trim();
      const notes = String(data.notes || "").trim();

      const stmt = db.prepare(\`
        INSERT INTO students (name, roll_number, grade, attendance_rate, fee_status, fee_amount, email, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      \`);
      const info = stmt.run(name, rollNumber, grade, attendanceRate, feeStatus, feeAmount, email, notes);
      const created = db.prepare("SELECT * FROM students WHERE id = ?").get(info.lastInsertRowid);
      return sendJson(201, created);
    } catch (err) {
      return sendJson(400, { error: "Failed to create student: " + err.message });
    }
  }

  // 5. PATCH /api/students/:id
  const patchMatch = pathname.match(/^\\/api\\/students\\/(\\d+)$/);
  if (method === "PATCH" && patchMatch) {
    try {
      const id = parseInt(patchMatch[1], 10);
      const existing = db.prepare("SELECT * FROM students WHERE id = ?").get(id);
      if (!existing) {
        return sendJson(404, { error: "Student not found" });
      }
      const data = await readBody();
      const name = data.name !== undefined ? String(data.name).trim() : existing.name;
      const rollNumber = (data.rollNumber || data.roll_number) !== undefined ? String(data.rollNumber || data.roll_number).trim() : existing.roll_number;
      const grade = data.grade !== undefined ? String(data.grade).trim() : existing.grade;
      const attRate = (data.attendanceRate || data.attendance_rate) !== undefined ? Number(data.attendanceRate || data.attendance_rate) : existing.attendance_rate;
      const feeStatus = (data.feeStatus || data.fee_status) !== undefined ? String(data.feeStatus || data.fee_status).trim() : existing.fee_status;
      const feeAmount = (data.feeAmount || data.fee_amount) !== undefined ? Number(data.feeAmount || data.fee_amount) : existing.fee_amount;
      const email = data.email !== undefined ? String(data.email).trim() : existing.email;
      const notes = data.notes !== undefined ? String(data.notes).trim() : existing.notes;

      db.prepare(\`
        UPDATE students
        SET name = ?, roll_number = ?, grade = ?, attendance_rate = ?, fee_status = ?, fee_amount = ?, email = ?, notes = ?
        WHERE id = ?
      \`).run(name, rollNumber, grade, attRate, feeStatus, feeAmount, email, notes, id);

      const updated = db.prepare("SELECT * FROM students WHERE id = ?").get(id);
      return sendJson(200, updated);
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // 6. DELETE /api/students/:id
  const deleteMatch = pathname.match(/^\\/api\\/students\\/(\\d+)$/);
  if (method === "DELETE" && deleteMatch) {
    try {
      const id = parseInt(deleteMatch[1], 10);
      const existing = db.prepare("SELECT * FROM students WHERE id = ?").get(id);
      if (!existing) {
        return sendJson(404, { error: "Student not found" });
      }
      db.prepare("DELETE FROM students WHERE id = ?").run(id);
      db.prepare("DELETE FROM attendance_records WHERE student_id = ?").run(id);
      return sendJson(200, { success: true, deletedId: id });
    } catch (err) {
      return sendJson(500, { error: err.message });
    }
  }

  // 7. POST /api/attendance
  if (method === "POST" && pathname === "/api/attendance") {
    try {
      const data = await readBody();
      const studentId = parseInt(data.studentId || data.student_id, 10);
      const student = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId);
      if (!student) {
        return sendJson(404, { error: "Student not found" });
      }
      const date = String(data.date || new Date().toISOString().split("T")[0]);
      const status = String(data.status || "Present");
      const notes = String(data.notes || "");

      db.prepare(\`
        INSERT INTO attendance_records (student_id, date, status, notes)
        VALUES (?, ?, ?, ?)
      \`).run(studentId, date, status, notes);

      // Recompute attendance rate
      const totalRecords = Number(db.prepare("SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ?").get(studentId).c);
      const presentRecords = Number(db.prepare("SELECT COUNT(*) AS c FROM attendance_records WHERE student_id = ? AND status = 'Present'").get(studentId).c);
      let newRate = 100.0;
      if (totalRecords > 0) {
        newRate = Math.round((presentRecords / totalRecords) * 1000) / 10;
      }
      db.prepare("UPDATE students SET attendance_rate = ? WHERE id = ?").run(newRate, studentId);

      const updated = db.prepare("SELECT * FROM students WHERE id = ?").get(studentId);
      return sendJson(200, { success: true, student: updated });
    } catch (err) {
      return sendJson(400, { error: "Attendance logging failed: " + err.message });
    }
  }

  // Static File Serving
  let filePath = path.join(__dirname, "public", pathname === "/" ? "index.html" : pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  sendJson(404, { error: "Not found" });
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(\`Student Management Server running at http://localhost:\${PORT}\`);
  });
}
`;

  files.push({
    relativePath: "server.js",
    content: serverJs
  });

  // 3. public/index.html
  const observedButtons: string[] = Array.isArray(spec.metadata?.observedButtons)
    ? (spec.metadata.observedButtons as string[]).filter(b => typeof b === "string" && b.trim())
    : [];
  const standardStudentButtons = ["enroll", "student", "paid", "pending", "attendance", "delete"];
  const extraObservedButtons = observedButtons.filter(
    b => !standardStudentButtons.some(ss => b.toLowerCase().includes(ss))
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
  <div class="app-container">
    <header class="app-header">
      <div class="brand">
        <h1>${spec.title}</h1>
        <p class="subtitle">Autonomous Student Academic, Attendance & Fee Tracking System</p>
      </div>
      ${extraObservedButtons.length > 0 ? `
      <div class="header-observed-controls">
        ${extraObservedButtons.map((btn, idx) => `<button type="button" id="btn-observed-${idx}" class="btn btn-observed">${escapeHtmlText(btn)}</button>`).join("\n        ")}
      </div>` : ""}
      <div class="header-stats">
        <div class="stat-badge stat-total">Total: <strong id="kpi-total">0</strong></div>
        <div class="stat-badge stat-attendance">Avg Attendance: <strong id="kpi-attendance">0%</strong></div>
        <div class="stat-badge stat-paid">Collected: <strong id="kpi-fees-paid">$0</strong></div>
        <div class="stat-badge stat-pending">Pending: <strong id="kpi-fees-pending">$0</strong></div>
      </div>
    </header>

    <main class="main-content">
      <!-- Left: Enrollment Form -->
      <section class="form-panel">
        <h2>Enroll Student</h2>
        <form id="student-form">
          <div class="form-group">
            <label for="student-name">Student Full Name *</label>
            <input type="text" id="student-name" name="name" required placeholder="e.g. Alex Chen">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="student-roll">Roll Number</label>
              <input type="text" id="student-roll" name="rollNumber" value="STU-1004" placeholder="STU-1004">
            </div>
            <div class="form-group">
              <label for="student-grade">Class / Grade</label>
              <input type="text" id="student-grade" name="grade" value="Grade 10" placeholder="Grade 10">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="student-fee">Fee Amount ($)</label>
              <input type="number" id="student-fee" name="feeAmount" value="1200" step="50">
            </div>
            <div class="form-group">
              <label for="student-fee-status">Fee Status</label>
              <select id="student-fee-status" name="feeStatus">
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="student-notes">Notes / Remarks</label>
            <textarea id="student-notes" name="notes" rows="2" placeholder="Scholarship, remarks or medical notes..."></textarea>
          </div>

          <button type="submit" id="btn-enroll-student" class="btn btn-primary">+ Enroll Student</button>
        </form>
      </section>

      <!-- Right: Directory & List -->
      <section class="directory-panel">
        <div class="filter-bar">
          <button type="button" class="btn filter-btn active" data-filter="all">All Students</button>
          <button type="button" class="btn filter-btn" data-filter="paid">Fees Paid</button>
          <button type="button" class="btn filter-btn" data-filter="pending">Fees Pending</button>
          <button type="button" class="btn filter-btn" data-filter="low-attendance">Low Attendance (&lt;85%)</button>
        </div>

        <div class="search-bar">
          <input type="text" id="search-input" placeholder="Search by student name or roll number...">
        </div>

        <div id="student-list" class="student-list">
          <!-- Rendered dynamically -->
        </div>
      </section>
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
  const styleCss = `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f8fafc;
  color: #0f172a;
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
  padding: 18px 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.brand h1 {
  font-size: 1.5rem;
  color: #1e3a8a;
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
  gap: 10px;
  flex-wrap: wrap;
}

.stat-badge {
  font-size: 0.85rem;
  padding: 6px 14px;
  border-radius: 20px;
  background: #f1f5f9;
  font-weight: 600;
  color: #334155;
}

.stat-attendance { background: #eff6ff; color: #1d4ed8; }
.stat-paid { background: #ecfdf5; color: #047857; }
.stat-pending { background: #fffbeb; color: #b45309; }

.main-content {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
}

@media (max-width: 840px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}

.form-panel, .directory-panel {
  background: #ffffff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.form-panel h2 {
  font-size: 1.15rem;
  color: #1e293b;
  margin-bottom: 16px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

input[type="text"],
input[type="number"],
select,
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
  color: inherit;
  background: #ffffff;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  width: 100%;
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-btn {
  background: #f1f5f9;
  color: #475569;
  padding: 6px 14px;
  font-size: 0.85rem;
  border-radius: 20px;
}

.filter-btn.active {
  background: #2563eb;
  color: #ffffff;
}

.search-bar {
  margin-bottom: 20px;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.student-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  transition: box-shadow 0.2s ease;
  flex-wrap: wrap;
  gap: 12px;
}

.student-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.student-info h3 {
  font-size: 1.05rem;
  color: #0f172a;
  margin-bottom: 4px;
}

.student-meta {
  font-size: 0.8rem;
  color: #64748b;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 12px;
  display: inline-block;
}

.badge-att-high { background: #dcfce7; color: #15803d; }
.badge-att-low { background: #fee2e2; color: #b91c1c; }
.badge-fee-paid { background: #ecfdf5; color: #047857; }
.badge-fee-pending { background: #fffbeb; color: #b45309; }

.student-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
  border-radius: 6px;
}

.btn-toggle-fee {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #334155;
}

.btn-toggle-fee:hover {
  background: #e2e8f0;
}

.btn-delete {
  background: #fee2e2;
  color: #dc2626;
}

.btn-delete:hover {
  background: #fecaca;
}
`;

  files.push({
    relativePath: "public/style.css",
    content: styleCss
  });

  // 5. public/app.js
  const appJs = `let currentFilter = "all";
let currentSearch = "";

async function fetchAnalytics() {
  try {
    const res = await fetch("/api/analytics");
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById("kpi-total").textContent = data.totalStudents || 0;
    document.getElementById("kpi-attendance").textContent = (data.averageAttendance || 0) + "%";
    document.getElementById("kpi-fees-paid").textContent = "$" + (data.totalFeesCollected || 0).toLocaleString();
    document.getElementById("kpi-fees-pending").textContent = "$" + (data.totalFeesPending || 0).toLocaleString();
  } catch (err) {
    console.error("Failed to load analytics:", err);
  }
}

async function fetchStudents() {
  try {
    let url = "/api/students?filter=" + encodeURIComponent(currentFilter);
    if (currentSearch) {
      url += "&search=" + encodeURIComponent(currentSearch);
    }
    const res = await fetch(url);
    if (!res.ok) return;
    const students = await res.json();
    renderStudents(students);
  } catch (err) {
    console.error("Failed to fetch students:", err);
  }
}

function renderStudents(students) {
  const container = document.getElementById("student-list");
  if (!students || students.length === 0) {
    container.innerHTML = '<div style="padding:24px; text-align:center; color:#94a3b8;">No matching student records found.</div>';
    return;
  }

  container.innerHTML = students.map(s => {
    const isPaid = String(s.fee_status || "").toLowerCase() === "paid";
    const attRate = Number(s.attendance_rate || 0);
    const isLowAtt = attRate < 85.0;

    return \`
      <div class="student-card" data-id="\${s.id}">
        <div class="student-info">
          <h3>\${escapeHtml(s.name)}</h3>
          <div class="student-meta">
            <span>Roll: <strong>\${escapeHtml(s.roll_number)}</strong></span>
            <span>Grade: <strong>\${escapeHtml(s.grade)}</strong></span>
            <span class="badge \${isLowAtt ? 'badge-att-low' : 'badge-att-high'}">\${attRate}% Attendance</span>
            <span class="badge \${isPaid ? 'badge-fee-paid' : 'badge-fee-pending'}">\${isPaid ? 'Fees Paid' : 'Fee Pending ($' + Number(s.fee_amount || 0) + ')'}</span>
          </div>
        </div>
        <div class="student-actions">
          <button type="button" class="btn btn-sm btn-toggle-fee" onclick="toggleFeeStatus(\${s.id}, '\${isPaid ? 'Pending' : 'Paid'}')">
            Mark \${isPaid ? 'Pending' : 'Paid'}
          </button>
          <button type="button" class="btn btn-sm btn-delete" onclick="deleteStudent(\${s.id})">
            Delete
          </button>
        </div>
      </div>
    \`;
  }).join("");
}

function escapeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function toggleFeeStatus(id, newStatus) {
  try {
    const res = await fetch("/api/students/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeStatus: newStatus })
    });
    if (res.ok) {
      await fetchStudents();
      await fetchAnalytics();
    }
  } catch (err) {
    console.error("Fee status toggle failed:", err);
  }
}

async function deleteStudent(id) {
  if (!confirm("Are you sure you want to delete this student record?")) return;
  try {
    const res = await fetch("/api/students/" + id, { method: "DELETE" });
    if (res.ok) {
      await fetchStudents();
      await fetchAnalytics();
    }
  } catch (err) {
    console.error("Student deletion failed:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchAnalytics();
  fetchStudents();

  // Form enrollment submit
  const form = document.getElementById("student-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        name: (document.getElementById("student-name") && document.getElementById("student-name").value) || "New Student",
        rollNumber: (document.getElementById("student-roll") && document.getElementById("student-roll").value) || ("STU-" + Math.floor(1000 + Math.random() * 9000)),
        grade: (document.getElementById("student-grade") && document.getElementById("student-grade").value) || "Grade 10",
        feeAmount: parseFloat(document.getElementById("student-fee") ? document.getElementById("student-fee").value : "1200") || 1200,
        feeStatus: (document.getElementById("student-fee-status") && document.getElementById("student-fee-status").value) || "Pending",
        notes: (document.getElementById("student-notes") && document.getElementById("student-notes").value) || ""
      };

      try {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          form.reset();
          if (document.getElementById("student-roll")) document.getElementById("student-roll").value = "STU-" + Math.floor(1000 + Math.random() * 9000);
          if (document.getElementById("student-grade")) document.getElementById("student-grade").value = "Grade 10";
          if (document.getElementById("student-fee")) document.getElementById("student-fee").value = "1200";
          await fetchStudents();
          await fetchAnalytics();
        }
      } catch (err) {
        console.error("Enrollment failed:", err);
      }
    });
  }

  // Filter buttons
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter") || "all";
      fetchStudents();
    });
  });

  // Search input
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    let debounce;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        currentSearch = e.target.value.trim();
        fetchStudents();
      }, 200);
    });
  }
});

window.toggleFeeStatus = toggleFeeStatus;
window.deleteStudent = deleteStudent;
`;

  files.push({
    relativePath: "public/app.js",
    content: appJs
  });

  // 6. test.js
  const testJs = `import assert from "node:assert";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { server, db } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PORT = 4912;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: TEST_PORT,
      path,
      method,
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

server.listen(TEST_PORT, "127.0.0.1", async () => {
  try {
    console.log("Starting Student Management test suite...");

    // 1. Verify Database schema
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert(tables.includes("students"), "students table must exist in app.db");
    assert(tables.includes("attendance_records"), "attendance_records table must exist in app.db");

    // 2. Health Check
    const health = await makeRequest("GET", "/api/health");
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, "ok");
    assert.strictEqual(health.body.storage, "sqlite");

    // 3. Analytics Check
    const analytics = await makeRequest("GET", "/api/analytics");
    assert.strictEqual(analytics.status, 200);
    assert(typeof analytics.body.totalStudents === "number");
    assert(typeof analytics.body.averageAttendance === "number");
    assert(typeof analytics.body.totalFeesCollected === "number");

    // 4. Enroll Student via POST
    const newStudent = {
      name: "Jordan Lee",
      rollNumber: "STU-1004",
      grade: "Grade 11",
      feeAmount: 1400.0,
      feeStatus: "Pending",
      notes: "Test student enrollment"
    };
    const createRes = await makeRequest("POST", "/api/students", newStudent);
    assert.strictEqual(createRes.status, 201);
    assert(createRes.body.id);
    assert.strictEqual(createRes.body.name, "Jordan Lee");
    assert.strictEqual(createRes.body.fee_status, "Pending");

    // 5. Update Fee Status to Paid
    const patchRes = await makeRequest("PATCH", \`/api/students/\${createRes.body.id}\`, { feeStatus: "Paid" });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.body.fee_status, "Paid");

    // 6. Query filtering check
    const paidList = await makeRequest("GET", "/api/students?filter=paid");
    assert.strictEqual(paidList.status, 200);
    assert(paidList.body.some(s => s.id === createRes.body.id));

    console.log("Unit and structural verification PASSED successfully!");
    server.close(() => process.exit(0));
  } catch (err) {
    console.error("Test failure:", err);
    server.close(() => process.exit(1));
  }
});
`;

  files.push({
    relativePath: "test.js",
    content: testJs
  });

  // 7. workflow.test.js
  const workflowTestJs = `import assert from "node:assert";
import http from "node:http";
import { server, db } from "./server.js";

const WF_PORT = 4913;

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: "127.0.0.1",
      port: WF_PORT,
      path,
      method,
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

server.listen(WF_PORT, "127.0.0.1", async () => {
  try {
    console.log("Executing end-to-end user workflows...");

    // Workflow 1: Student Enrollment
    const enrolled = await req("POST", "/api/students", {
      name: "Taylor Swift",
      rollNumber: "STU-2001",
      grade: "Grade 12",
      feeAmount: 2000,
      feeStatus: "Pending"
    });
    assert.strictEqual(enrolled.status, 201);
    const studentId = enrolled.body.id;

    // Workflow 2: Daily Attendance Tracking
    const att1 = await req("POST", "/api/attendance", { studentId, status: "Present" });
    assert.strictEqual(att1.status, 200);
    const att2 = await req("POST", "/api/attendance", { studentId, status: "Absent" });
    assert.strictEqual(att2.status, 200);
    assert.strictEqual(att2.body.student.attendance_rate, 50.0);

    // Workflow 3: Fee Payment Status Reconciliation
    const feeUpdate = await req("PATCH", \`/api/students/\${studentId}\`, { feeStatus: "Paid" });
    assert.strictEqual(feeUpdate.status, 200);
    assert.strictEqual(feeUpdate.body.fee_status, "Paid");

    // Workflow 4: Directory Filtering
    const lowAtt = await req("GET", "/api/students?filter=low-attendance");
    assert.strictEqual(lowAtt.status, 200);
    assert(lowAtt.body.some(s => s.id === studentId));

    console.log("All workflows verified successfully!");
    server.close(() => process.exit(0));
  } catch (err) {
    console.error("Workflow failure:", err);
    server.close(() => process.exit(1));
  }
});
`;

  files.push({
    relativePath: "workflow.test.js",
    content: workflowTestJs
  });

  // 8. forgespec.json
  files.push({
    relativePath: "forgespec.json",
    content: JSON.stringify(spec, null, 2) + "\n"
  });

  // 9. README.md
  files.push({
    relativePath: "README.md",
    content: `# ${spec.title}

Autonomous Student Academic, Attendance, and Fee Tracking Application synthesized by Agent App Forge.

## Quickstart
\`\`\`bash
node server.js
\`\`\`
Visit http://localhost:3000 in your browser.

## Run Verification Tests
\`\`\`bash
node test.js
node workflow.test.js
\`\`\`
`
  });

  return {
    engineName: "fullstack-node",
    files,
    entryPointInstructions: `Run \`node server.js\` to launch ${spec.title} at http://localhost:3000 (persistent SQLite backend)`,
    supportedOnPlatform: true
  };
}
