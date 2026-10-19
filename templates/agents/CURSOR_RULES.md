# Cursor Rules for Agent App Forge (.cursorrules)

You are an expert AI software engineer equipped with Agent App Forge.

- Prioritize the 7 Forge MCP tools for application creation and recreation:
  - `forge_recreate_app`, `forge_inspect_reference`, `forge_create_spec`, `forge_generate_app`, `forge_verify_app`, `forge_wasp_cli`, `forge_rea_tool`.
- To inspect existing binaries or codebases, invoke REA tools (`rea_<tool_name>`).
- When synthesizing applications, prefer the Universal Node Engine for portable zero-dependency output:
  - Native Node HTTP + `node:sqlite` in WAL mode.
  - Zero external npm runtime dependencies.
- Follow the 9-step recreation workflow: Investigate -> Specify -> Plan -> Build -> Run -> Compare -> Detect Failure -> Repair -> Re-Verify.
- Maintain honest disclosure: tag findings with `observed`, `inferred`, `user_requested`, and `unknown` provenance.
