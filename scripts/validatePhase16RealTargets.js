import * as path from "node:path";
import * as fs from "node:fs";
import { RecreationOrchestrator } from "../dist/recreation/orchestrator.js";

async function main() {
  console.log("=== PHASE 16: REAL-WORLD TARGET VALIDATION ===");

  const orchestrator = new RecreationOrchestrator();

  // Target 1: example.com
  console.log("\n--- Target 1: https://example.com ---");
  const out1 = path.resolve("outputs", "phase16-example-com");
  if (fs.existsSync(out1)) fs.rmSync(out1, { recursive: true, force: true });
  try {
    const res1 = await orchestrator.recreate({
      prompt: "Recreate this website: https://example.com",
      outputDirectory: out1
    });
    console.log("Success:", res1.success);
    console.log("Domain:", res1.spec.metadata?.domain);
    console.log("Title:", res1.spec.title);
    console.log("Entities:", res1.spec.entities.map(e => e.name));
    console.log("Observed Buttons:", res1.spec.metadata?.observedButtons?.length || 0);
    console.log("Observed Headings:", res1.spec.metadata?.observedHeadings);
    console.log("Observed Paragraphs:", res1.spec.metadata?.observedParagraphs?.length);
    console.log("Observed Links:", res1.spec.metadata?.observedLinks);
    console.log("Quality Report:", JSON.stringify(res1.comparison?.applicationQuality, null, 2));
    console.log("Fidelity Report:", JSON.stringify(res1.comparison?.referenceFidelity, null, 2));
    console.log("Overall Comparison Status:", res1.comparison?.overallStatus);
    console.log("Final Report Results:", JSON.stringify(res1.finalReport?.results, null, 2));
  } catch (err) {
    console.error("Target 1 Error:", err);
  }

  // Target 2: httpbin.org
  console.log("\n--- Target 2: https://httpbin.org ---");
  const out2 = path.resolve("outputs", "phase16-httpbin-org");
  if (fs.existsSync(out2)) fs.rmSync(out2, { recursive: true, force: true });
  try {
    const res2 = await orchestrator.recreate({
      prompt: "Recreate this website: https://httpbin.org",
      outputDirectory: out2
    });
    console.log("Success:", res2.success);
    console.log("Domain:", res2.spec.metadata?.domain);
    console.log("Title:", res2.spec.title);
    console.log("Entities:", res2.spec.entities.map(e => e.name));
    console.log("Observed Endpoints:", res2.spec.metadata?.observedEndpoints?.length || 0);
    console.log("Quality Report:", JSON.stringify(res2.comparison?.applicationQuality, null, 2));
    console.log("Fidelity Report:", JSON.stringify(res2.comparison?.referenceFidelity, null, 2));
    console.log("Overall Comparison Status:", res2.comparison?.overallStatus);
  } catch (err) {
    console.error("Target 2 Error:", err);
  }

  // Target 3: todomvc
  console.log("\n--- Target 3: https://todomvc.com/examples/react/dist/ ---");
  const out3 = path.resolve("outputs", "phase16-todomvc");
  if (fs.existsSync(out3)) fs.rmSync(out3, { recursive: true, force: true });
  try {
    const res3 = await orchestrator.recreate({
      prompt: "Recreate this website: https://todomvc.com/examples/react/dist/",
      outputDirectory: out3
    });
    console.log("Success:", res3.success);
    console.log("Domain:", res3.spec.metadata?.domain);
    console.log("Title:", res3.spec.title);
    console.log("Entities:", res3.spec.entities.map(e => e.name));
    console.log("Quality Report:", JSON.stringify(res3.comparison?.applicationQuality, null, 2));
    console.log("Fidelity Report:", JSON.stringify(res3.comparison?.referenceFidelity, null, 2));
    console.log("Overall Comparison Status:", res3.comparison?.overallStatus);
  } catch (err) {
    console.error("Target 3 Error:", err);
  }

  console.log("\n=== VALIDATION RUN COMPLETE ===");
}

main().catch(console.error);
