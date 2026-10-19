let currentDocId = null;
let autosaveTimer = null;

const docListEl = document.getElementById("doc-list");
const titleInput = document.getElementById("doc-title");
const editorCanvas = document.getElementById("editor-canvas");
const editorContainer = document.getElementById("editor-container");
const emptyState = document.getElementById("empty-state");
const saveStatus = document.getElementById("save-status");
const wordCountEl = document.getElementById("word-count");
const btnNew = document.getElementById("btn-new-doc");
const btnExport = document.getElementById("btn-export");
const exportMenu = document.getElementById("export-menu");

function countWords(html) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

function updateWordCount() {
  const words = countWords(editorCanvas.innerHTML);
  wordCountEl.textContent = `${words} words`;
}

async function loadDocuments() {
  try {
    const res = await fetch("/api/documents");
    const docs = await res.json();
    renderDocumentList(docs);
    if (!currentDocId && docs.length > 0) {
      loadDocument(docs[0].id);
    } else if (docs.length === 0) {
      showEmptyState();
    }
  } catch (err) {
    console.error("Failed to fetch documents", err);
  }
}

function showEmptyState() {
  currentDocId = null;
  editorContainer.style.display = "none";
  emptyState.style.display = "flex";
}

function showEditor() {
  editorContainer.style.display = "flex";
  emptyState.style.display = "none";
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
    showEditor();
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
      body: JSON.stringify({ title: "New Document", content: "<p>Start typing...</p>" })
    });
    const doc = await res.json();
    loadDocument(doc.id);
  } catch (err) {
    console.error("Failed to create document", err);
  }
}

async function deleteDocument(id) {
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
          title: titleInput.value.trim() || "Untitled Document",
          content: editorCanvas.innerHTML
        })
      });
      saveStatus.textContent = "Saved";
      saveStatus.className = "badge badge-saved";
      loadDocuments();
    } catch (err) {
      saveStatus.textContent = "Error";
      saveStatus.className = "badge badge-error";
      console.error("Autosave failed", err);
    }
  }, 500);
}

// Formatting buttons
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
    window.open(`/api/documents/${currentDocId}/export?format=${format}`, "_blank");
  });
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.loadDocument = loadDocument;
window.deleteDocument = deleteDocument;
loadDocuments();
