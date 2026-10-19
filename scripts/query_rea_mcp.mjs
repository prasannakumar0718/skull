import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";

async function main() {
  console.log("Starting REA MCP connection test...");
  const transport = new StdioClientTransport({
    command: "npx.cmd",
    args: ["--yes", "rea-agents@6.7.0", "--mcp"]
  });

  const client = new Client({
    name: "forge-discovery-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log("Connected to REA MCP server!");

  const toolsResponse = await client.listTools();
  console.log(`Discovered ${toolsResponse.tools.length} tools from REA MCP server!`);

  // Write catalog to disk for evidence
  fs.writeFileSync(
    "docs/audits/rea_upstream_tools_catalog.json",
    JSON.stringify(toolsResponse.tools, null, 2),
    "utf8"
  );
  console.log("Saved tools to docs/audits/rea_upstream_tools_catalog.json");

  // Print first 10 tool names
  console.log("First 15 tools:", toolsResponse.tools.slice(0, 15).map(t => t.name));

  await client.close();
  console.log("Closed connection successfully.");
}

main().catch(err => {
  console.error("Error during REA discovery:", err);
  process.exit(1);
});
