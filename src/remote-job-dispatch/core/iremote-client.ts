import type { ServerConfig } from "@/infra/config";

export interface IRemoteClient {
  execute(server: ServerConfig, command: string): Promise<string>;
  copy(server: ServerConfig, from: string, to: string): Promise<string>;
}
