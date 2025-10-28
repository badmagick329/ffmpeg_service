import type { ServerConfig } from "@/infra/config";
import { basename } from "path";

export class ServerSelector {
  constructor(private servers: ServerConfig[]) {}

  selectServer(filePath: string): ServerConfig | undefined {
    const filename = basename(filePath);
    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    for (const server of this.servers) {
      if (filenameWithoutExt.includes(server.sshHost)) {
        return server;
      }
    }
    return undefined;
  }
}
