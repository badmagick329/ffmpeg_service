import type { ServerConfig } from "@/infra/config";

export interface IRemoteCommandExecutor {
  execute(server: ServerConfig, command: string): Promise<string>;
}
