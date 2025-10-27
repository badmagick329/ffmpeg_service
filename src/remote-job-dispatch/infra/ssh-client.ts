import type { ServerConfig } from "@/infra/config";
import type { IRemoteClient } from "@/remote-job-dispatch/core/iremote-client";
import { $ } from "bun";

export class SshClient implements IRemoteClient {
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
  async copy(server: ServerConfig, from: string, to: string): Promise<string> {
    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      from,
      to,
    ];

    console.log(`Running scp command:\n${`scp ${scpArgs.join(" ")}`}`);
    try {
      return await $`scp ${scpArgs}`.text();
    } catch (error) {
      console.error("SCP Error:", error);
      throw error;
    }
  }
}
