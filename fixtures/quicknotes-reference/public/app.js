let currentDocId = null;
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
  const clean = text.replace(/\s+/g, " ").trim();
  return clean ? clean.split(" ").length : 0;
}

function updateWordCount() {
  const words = countWords(editorCanvas.innerText);
  wordCountEl.textContent = `${words} word${words === 1 ? "" : "s"}`;
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
    li.className = `doc-item ${doc.id === currentDocId ? "active" : ""}`;
    li.innerHTML = `
      <span class="doc-name" onclick="loadDocument(${doc.id})">${escapeHtml(doc.title)}</span>
      <button class="btn-del-doc" onclick="deleteDocument(${doc.id})">&times;</button>
    `;
    docListEl.appendChild(li);
  });
}

async function loadDocument(id) {
  try {
    currentDocId = id;
    const res = await fetch(`/api/documents/${id}`);
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
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
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
      await fetch(`/api/documents/${currentDocId}`, {
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
    window.open(`/api/documents/${currentDocId}/export?format=${format}`, "_blank");
  });
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.loadDocument = loadDocument;
window.deleteDocument = deleteDocument;
loadDocuments();
