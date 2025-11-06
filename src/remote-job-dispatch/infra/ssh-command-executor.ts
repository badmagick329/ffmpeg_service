import type { RemoteConfig } from "@/infra/config";
import type { IRemoteCommandExecutor } from "@/remote-job-dispatch/core/iremote-executor";
import { $ } from "bun";

export class SshCommandExecutor implements IRemoteCommandExecutor {
  async execute(server: RemoteConfig, command: string): Promise<string> {
    const sshArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "ConnectTimeout=15",
      `${server.sshUser}@${server.sshHostIP}`,
      command,
    ];

    const result = await $`ssh ${sshArgs}`.text();
    return result;
  }
}
