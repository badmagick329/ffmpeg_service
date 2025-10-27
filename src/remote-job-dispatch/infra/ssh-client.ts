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
    const result = await $`scp ${scpArgs}`.text();
    return result;
  }
  async copyToServer(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<string> {
    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      localPath,
      `${server.sshUser}@${server.sshHost}:${remotePath}`,
    ];

    return await $`scp ${scpArgs}`.text();
  }
  async copyFromServer(
    server: ServerConfig,
    localPath: string,
    remotePath: string
  ): Promise<string> {
    const scpArgs = [
      ...(server.sshKeyPath ? ["-i", server.sshKeyPath] : []),
      "-o",
      "StrictHostKeyChecking=no",
      `${server.sshUser}@${server.sshHost}:${remotePath}`,
      localPath,
    ];

    return await $`scp ${scpArgs}`.text();
  }
}
