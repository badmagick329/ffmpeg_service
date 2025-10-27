import type { ServerConfig } from "@/infra/config";

export interface IRemoteClient {
  execute(server: ServerConfig, command: string): Promise<string>;
  copyToServer(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<string>;
  copyFromServer(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<string>;
}
