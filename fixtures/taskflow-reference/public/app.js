let allTasks = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-task-form");
  const filterButtons = document.querySelectorAll(".filter-btn");

  form.addEventListener("submit", handleCreateTask);

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
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
    category: categorySelect.value,
    priority: prioritySelect.value,
    notes: notesInput.value.trim()
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
      notesInput.value = "";
      renderTasks();
      updateStats();
    }
  } catch (err) {
    console.error("Failed to create task:", err);
  }
}

async function toggleTask(id, currentStatus) {
  try {
    const res = await fetch(`/api/tasks/${id}`, {
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
    const res = await fetch(`/api/tasks/${id}`, {
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
  container.innerHTML = "";

  const filtered = allTasks.filter((task) => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return Boolean(task.completed);
    if (currentFilter === "high") return task.priority === "high";
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 32px; text-align: center; color: #94a3b8; background: #fff; border-radius: 8px;">No tasks found.</div>`;
    return;
  }

  filtered.forEach((task) => {
    const card = document.createElement("div");
    card.className = `task-item priority-${task.priority} ${task.completed ? "is-completed" : ""}`;
    card.dataset.id = task.id;

    card.innerHTML = `
      <div class="task-info">
        <div class="task-meta">
          <span class="badge-category">${escapeHtml(task.category || "General")}</span>
          <span class="badge-priority ${task.priority}">${task.priority}</span>
        </div>
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ""}
      </div>
      <div class="task-actions">
        <button type="button" class="btn btn-toggle" onclick="toggleTask(${task.id}, ${Boolean(task.completed)})">
          ${task.completed ? "Reopen" : "Complete"}
        </button>
        <button type="button" class="btn btn-delete" onclick="deleteTask(${task.id})">
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function updateStats() {
  const total = allTasks.length;
  const completed = allTasks.filter((t) => t.completed).length;
  const active = total - completed;

  document.getElementById("stat-total").textContent = `Total: ${total}`;
  document.getElementById("stat-active").textContent = `Active: ${active}`;
  document.getElementById("stat-completed").textContent = `Completed: ${completed}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
