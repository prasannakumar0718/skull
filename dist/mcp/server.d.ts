import { Server } from "@modelcontextprotocol/sdk/server/index.js";
export type ForgeMcpMode = "compact" | "full";
export interface ForgeMcpServerOptions {
    reaPath?: string;
    mode?: ForgeMcpMode;
}
export declare const FORGE_SERVER_INSTRUCTIONS: string;
export declare function createForgeMcpServer(optionsOrReaPath?: string | ForgeMcpServerOptions): Server;
export declare function runForgeMcpServer(optionsOrReaPath?: string | ForgeMcpServerOptions): Promise<void>;
