import type { ServerConfig } from "@/infra/config";

export interface IRemoteExecutor {
  execute(server: ServerConfig, command: string): Promise<string>;
}
