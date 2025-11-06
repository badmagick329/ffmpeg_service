import type { RemoteConfig } from "@/infra/config";

export interface IRemoteCommandExecutor {
  execute(server: RemoteConfig, command: string): Promise<string>;
}
