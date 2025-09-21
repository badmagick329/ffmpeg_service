import conf from "../../config.toml";
import { mkdirSync } from "fs";

type ConfigType = {
  incomingDir: string;
  outgoingDir: string;
  cmdsInputDir: string;
  serverConfigs: { copytTo: string }[];
};

export const config: ConfigType = {
  incomingDir: conf.incomingDir,
  outgoingDir: conf.outgoingDir,
  cmdsInputDir: conf.cmdsInputDir,
  serverConfigs: conf.serverConfigs,
};

mkdirSync(config.incomingDir, { recursive: true });
mkdirSync(config.outgoingDir, { recursive: true });
mkdirSync(config.cmdsInputDir, { recursive: true });
