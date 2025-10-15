import conf from "../../config.toml";
import { mkdirSync } from "fs";

type ConfigType = {
  incomingDir: string;
  outgoingDir: string;
  cmdsInputDir: string;
  serverConfigs: { copyTo: string }[];
};

export const config: ConfigType = {
  incomingDir: conf.incomingDir,
  outgoingDir: conf.outgoingDir,
  cmdsInputDir: conf.cmdsInputDir,
  serverConfigs: conf.serverConfigs,
};

export function initDirectories() {
  mkdirSync(config.incomingDir, { recursive: true });
  mkdirSync(config.outgoingDir, { recursive: true });
  mkdirSync(config.cmdsInputDir, { recursive: true });
}
