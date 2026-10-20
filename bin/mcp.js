#!/usr/bin/env node
import { runForgeMcpServer } from "../dist/mcp/server.js";

const args = process.argv.slice(2);
let mode = process.env.FORGE_MCP_MODE || "compact";

if (args.includes("--full") || args.includes("-f")) {
  mode = "full";
} else {
  const modeIdx = args.indexOf("--mode");
  if (modeIdx !== -1 && args[modeIdx + 1]) {
    mode = args[modeIdx + 1];
  }
}

let reaPath = process.env.FORGE_REA_PATH;
const reaIdx = args.indexOf("--rea-path");
if (reaIdx !== -1 && args[reaIdx + 1]) {
  reaPath = args[reaIdx + 1];
}

runForgeMcpServer({ reaPath, mode }).catch((err) => {
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
