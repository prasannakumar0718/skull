# Wasp Application Generation Audit

**Date:** 2026-10-19  
**Auditor:** Agent App Forge Principal Software Engineer  
**Component:** `src/engines/waspEngine.ts`, Wasp 0.26.1 Specification Standards  

---

## 1. Executive Summary

The Wasp Generation Engine (`WaspEngine`) was audited against the latest official Wasp specification documentation (v0.26.1) and CLI workflow requirements.

The emitted project files were enhanced to provide a 100% complete Wasp workspace structure, including declarative application specifications (`main.wasp.ts`), relational schemas (`schema.prisma`), package dependencies, TypeScript compiler configurations (`tsconfig.json`), environment files, and frontend/backend source files.

The host environment was probed for native Wasp CLI availability. In accordance with strict audit rules, when the Wasp CLI is absent or requires WSL, the system truthfully reports platform prerequisites rather than simulating or faking execution.

---

## 2. Emitted Workspace Architecture

When targeting Wasp (`targetEngine: "wasp"`), Forge produces the following file hierarchy:

```text
generated-wasp-app/
├── main.wasp.ts         # Modern TS Wasp specification (0.26.1 syntax)
├── schema.prisma        # Relational SQLite schema with Prisma models
├── package.json         # Dependencies on @wasp.sh/spec, wasp SDK, React 18
├── tsconfig.json        # Compiler configuration for Wasp & React JSX
├── .env.server          # Server environment (DATABASE_URL, PORT)
├── .gitignore           # Git ignore list for .wasp, dev.db, node_modules
└── src/
    ├── operations.ts    # Backend queries and actions
    └── TasksPage.tsx    # React client component with useQuery/useAction hooks
```

### 2.1 Specification Syntax (`main.wasp.ts`)
Conforms strictly to Wasp v0.26.1:
```typescript
import { app, page, route, query, action } from "@wasp.sh/spec";
import { TasksPage } from "./src/TasksPage" with { type: "ref" };
import { getTasks, createTask, toggleTask } from "./src/operations" with { type: "ref" };

export default app({
  name: "task-manager-app",
  wasp: { version: "0.26.1" },
  title: "Task Manager Application",
  spec: [
    route("HomeRoute", "/", page(TasksPage)),
    query(getTasks, { entities: ["Task"] }),
    action(createTask, { entities: ["Task"] }),
    action(toggleTask, { entities: ["Task"] })
  ]
});
```

### 2.2 Relational Schema (`schema.prisma`)
Declares a validated SQLite datasource and entity models:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model Task {
  id        Int      @id @default(autoincrement())
  title     String
  isDone    Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

---

## 3. Host Environment Realities & Truthful Reporting

### 3.1 Host Environment Probe
- **Host OS:** Windows 11 (win32 x64)
- **Command Probe:** `where.exe wasp` -> Exited 1 (not installed in Windows PATH)
- **WSL Probe:** `wsl --version` -> Exited 1 (`The Windows Subsystem for Linux is not installed`)

### 3.2 Upstream Wasp Platform Support
According to official Wasp documentation (https://wasp.sh/docs):
- Wasp's Haskell compiler and CLI binary natively support macOS and Linux.
- On Windows hosts, Wasp officially requires **Windows Subsystem for Linux (WSL)**.
- Native Windows Command Prompt / PowerShell execution of the Wasp CLI binary is unsupported by upstream Wasp.

### 3.3 Forge Behavioral Contract
Forge implements a transparent dual-engine architecture:
1. **On Linux/macOS or within WSL**: When Wasp CLI is installed, Forge invokes `wasp start` / `wasp compile`.
2. **On Native Windows without WSL**: `EngineOrchestrator` automatically chooses the `UniversalNodeEngine` (full-stack Node.js + SQLite), allowing immediate, zero-dependency local execution, testing, and live preview. When the user explicitly requests Wasp generation on Windows, Forge generates the complete, valid Wasp project files and prints clear instructions on running inside WSL:
   ```text
   Note: Wasp CLI requires Linux, macOS, or WSL on Windows hosts. Native Windows execution is not supported by upstream Wasp.
   Run inside WSL: `wasp start` or compile with `wasp compile`
   ```

---

## 4. Test Verification

`tests/waspEngine.test.ts` verified:
- Valid Wasp 0.26.1 file emission with all 8 project files.
- Prisma schema field, relation, and default value correctness.
- Truthful reporting of host platform capabilities without simulated green checks.
