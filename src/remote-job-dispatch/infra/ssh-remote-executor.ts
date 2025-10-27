import type { ServerConfig } from "@/infra/config";
import type { IRemoteExecutor } from "@/remote-job-dispatch/core/iremote-executor";
import { $ } from "bun";

export class SshRemoteExecutor implements IRemoteExecutor {
  async execute(server: ServerConfig, command: string): Promise<string> {
    const sshArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      `${server.sshUser}@${server.sshHost}`,
      command,
    ];

    const result = await $`ssh ${sshArgs}`.text();
    return result;
  }
}
