#!/usr/bin/env node
import { runForgeMcpServer } from "../dist/mcp/server.js";

runForgeMcpServer().catch((err) => {
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
