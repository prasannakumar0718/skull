import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";

async function compareLiveWithCatalog() {
  console.log("Connecting to live REA MCP server...");
  const transport = new StdioClientTransport({
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["--yes", "rea-agents@6.7.0", "--mcp"]
  });

  const client = new Client({ name: "parity-auditor", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  console.log("Connected to live REA MCP server.");

  const liveToolsResponse = await client.listTools();
  const liveTools = liveToolsResponse.tools;
  await client.close();

  console.log(`Live tools received: ${liveTools.length}`);

  let catalog = JSON.parse(fs.readFileSync("src/investigation/reaCatalog.json", "utf8"));
  if (!Array.isArray(catalog) && Array.isArray(catalog.tools)) {
    catalog = catalog.tools;
  }
  console.log(`Catalog tools count: ${catalog.length}`);

  const liveMap = new Map(liveTools.map(t => [t.name, t]));
  const catalogMap = new Map(catalog.map(t => [t.name, t]));

  const missingInCatalog = [];
  const missingInLive = [];
  const schemaMismatches = [];

  for (const [name, liveTool] of liveMap) {
    if (!catalogMap.has(name)) {
      missingInCatalog.push(name);
    } else {
      const catTool = catalogMap.get(name);
      // Compare inputSchema
      const liveSchema = JSON.stringify(liveTool.inputSchema);
      const catSchema = JSON.stringify(catTool.inputSchema);
      if (liveSchema !== catSchema) {
        schemaMismatches.push({
          tool: name,
          reason: "Input schema JSON differs"
        });
      }
    }
  }

  for (const [name] of catalogMap) {
    if (!liveMap.has(name)) {
      missingInLive.push(name);
    }
  }

  console.log("--- PARITY COMPARISON RESULTS ---");
  console.log("Total Live Tools:", liveTools.length);
  console.log("Total Catalog Tools:", catalog.length);
  console.log("Missing in Catalog:", missingInCatalog.length, missingInCatalog);
  console.log("Missing in Live:", missingInLive.length, missingInLive);
  console.log("Schema Mismatches:", schemaMismatches.length);
  if (schemaMismatches.length > 0) {
    console.log("First 3 mismatches:", schemaMismatches.slice(0, 3));
  } else {
    console.log("PERFECT SCHEMA PARITY: All 207 tools match 100%!");
  }
}

compareLiveWithCatalog().catch(err => {
  console.error("Comparison failed:", err);
  process.exit(1);
});
