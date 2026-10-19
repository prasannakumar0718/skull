# Agent App Forge — Public Release & Distribution Guide

> **IMPORTANT**: This guide provides the exact verification steps, packaging checks, and publication commands. In accordance with safety rules, **no code is pushed to any remote and no package is published to npm without explicit user authorization.**

---

## 1. Pre-Publication Verification Checklist

Before publishing Agent App Forge to GitHub or the public npm registry, ensure all 10 release requirements are satisfied:

- [ ] **Working Tree Cleanliness**: All changes committed; no untracked secrets, credentials, or personal paths.
- [ ] **Test Suite 100% Passing**: `npm test` passes all 77 tests across 15 test suites with zero failures and zero unhandled errors.
- [ ] **Build Verification**: `npm run build` compiles clean TypeScript and copies `reaCatalog.json` to `dist/investigation/`.
- [ ] **Packaging Dry-Run**: `npm pack --dry-run` confirms only distribution files are included (`dist/`, `bin/`, `config/`, `templates/`, `LICENSE`, `README.md`).
- [ ] **Executable Entrypoints**: Both `forge` and `agent-app-forge` binaries have execution permissions (`#!/usr/bin/env node`).
- [ ] **Cross-Platform Compatibility**: No hardcoded Windows paths (e.g. `D:\git hub\...`) in templates or distribution files.
- [ ] **Upstream Repositories**: Upstream `wasp` and `rea` repositories remain 100% clean and unmodified.
- [ ] **Registry Availability**: Package name `agent-app-forge` confirmed available on the npm registry.
- [ ] **Agent Adapters**: All 10 client configurations verified and portable `npx` commands tested.
- [ ] **User Approval**: Explicit authorization from the repository owner before executing any network push or publication command.

---

## 2. Packaging Inspection (`npm pack`)

Verify the tarball contents without publishing:

```bash
npm pack --dry-run
```

Expected tarball contents:
```
package/
├── LICENSE
├── README.md
├── package.json
├── bin/
│   ├── forge.js
│   └── mcp.js
├── dist/
│   ├── ... (compiled JS & .d.ts files)
│   └── investigation/
│       └── reaCatalog.json
├── config/
│   └── agent-compatibility.json
└── templates/
    ├── agents/
    │   ├── AGENT_INSTRUCTIONS.md
    │   ├── CLAUDE.md
    │   ├── CURSOR_RULES.md
    │   ├── COPILOT_INSTRUCTIONS.md
    │   └── SKILL.md
    └── mcp/
        ├── claude_desktop_config.json
        ├── cursor_mcp.json
        ├── cline_mcp_settings.json
        ├── roo_mcp_settings.json
        ├── windsurf_mcp_config.json
        ├── opencode_mcp.json
        └── antigravity_mcp.json
```

---

## 3. GitHub Publication Commands (Awaiting User Authorization)

When the user specifies the target GitHub organization/user (e.g. `https://github.com/<user>/agent-app-forge.git`):

```bash
# 1. Add GitHub remote
git remote add origin https://github.com/<user>/agent-app-forge.git

# 2. Push main branch
git push -u origin master:main

# 3. Create version tag
git tag -a v0.1.0 -m "Release v0.1.0: Agent-Agnostic Software Recreation System"
git push origin v0.1.0
```

---

## 4. npm Publication Commands (Awaiting User Authorization)

When authorized to publish the npm package:

```bash
# 1. Log in to npm registry
npm login

# 2. Verify whoami
npm whoami

# 3. Publish package with public access
npm publish --access public
```

Once published, any developer worldwide can immediately run:
```bash
npx agent-app-forge doctor
npx agent-app-forge capabilities
npx agent-app-forge mcp
```
or install globally:
```bash
npm install -g agent-app-forge
forge capabilities
```
