import type { LogConfig } from "@/common/logger-port";
import conf from "../../config.toml";
import { mkdirSync } from "fs";

type ConfigType = {
  incomingDir: string;
  outgoingDir: string;
  cmdsInputDir: string;
  jobPollInterval: number;
  logConfig: LogConfig;
  serverConfigs: { copyTo: string }[];
};

export const config: ConfigType = {
  incomingDir: conf.incomingDir,
  outgoingDir: conf.outgoingDir,
  cmdsInputDir: conf.cmdsInputDir,
  jobPollInterval: conf.jobPollInterval,
  logConfig: conf.logConfig,
  serverConfigs: conf.serverConfigs,
};

export function initDirectories() {
  mkdirSync(config.incomingDir, { recursive: true });
  mkdirSync(config.outgoingDir, { recursive: true });
  mkdirSync(config.cmdsInputDir, { recursive: true });
}
