import type { ServerConfig } from "@/infra/config";
import { basename } from "node:path";
import type { ClientStateManager } from "@/remote-job-dispatch/core/client-state-manager";
import type { IFileOperations } from "@/remote-job-dispatch/core/ifile-operations";

export class RemoteFileCleanup {
  constructor(
    private readonly fileOperations: IFileOperations,
    private readonly stateManager: ClientStateManager,
    private readonly servers: ServerConfig[]
  ) {}

  async fetchRemoteInputFiles() {
    const remoteFilesQuery = this.servers.map(async (server) =>
      (await this.fileOperations.getRemoteInputFiles(server)).map((files) => {
        return { server, files };
      })
    );
    const filesByServer = await Promise.all(remoteFilesQuery);
    const errorsByServer = Object.fromEntries(
      filesByServer
        .filter((r) => r.isFailure)
        .map((e) => {
          const error = e.unwrapError();
          return [[error.server], error.message];
        })
        .filter((e) => e.length > 0)
    ) as { [key: string]: string };

    const remoteFilesByServer = Object.fromEntries(
      filesByServer
        .filter((r) => r.isSuccess)
        .map((r) => {
          const { server, files } = r.unwrap();
          return [[server.serverName || server.sshHostIP], new Set(files)];
        })
    ) as { [key: string]: Set<string> };
    return {
      remoteFilesByServer,
      errorsByServer,
    };
  }

  async findFilesToRemove(remoteFilesByServer: { [key: string]: Set<string> }) {
    const candidateUnusedFiles =
      await this.stateManager.getUnusedInputFilesOnServers(this.servers);

    return candidateUnusedFiles
      .map((files) => {
        const filesPresentOnServer =
          remoteFilesByServer[
            files.server.serverName || files.server.sshHostIP
          ];
        return {
          server: files.server,
          uploadedInputFiles: files.uploadedInputFiles.filter((i) =>
            filesPresentOnServer?.has(basename(i.remoteFile))
          ),
        };
      })
      .filter((i) => i.uploadedInputFiles.length > 0);
  }
}
