import http from "node:http";

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
  console.log("Verifying observable workflows for " + "QuickNotes Online" + "...");

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
