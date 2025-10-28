import type { ServerConfig } from "@/infra/config";
import { basename } from "path";

export class ServerSelector {
  constructor(private servers: ServerConfig[]) {}

  selectServer(filePath: string): ServerConfig | undefined {
    const filename = basename(filePath);
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    for (const server of this.servers) {
      if (filenameWithoutExt.includes(server.serverName)) {
        return server;
      }
    }

    for (const server of this.servers) {
      if (filenameWithoutExt.includes(server.sshHostIP)) {
        console.warn(
          `⚠️  Matched by IP (${server.sshHostIP}) instead of serverName. ` +
            `Consider renaming file to include "${server.serverName}"`
        );
        return server;
      }
    }

    return undefined;
  }
}
