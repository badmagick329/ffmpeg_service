import type { LogConfig } from "@/common/logger-port";
import conf from "../../config.toml";
import { mkdirSync } from "fs";

export type ServerConfig = {
  sshHost: string;
  sshUser: string;
  sshKeyPath?: string;
  remoteWorkDir: string;
  remoteCmdsDir: string;
  copyTo: string;
  copyFrom: string;
};

type ConfigType = {
  incomingDir: string;
  outgoingDir: string;
  cmdsInputDir: string;
  jobPollInterval: number;
  inputFilesReconciliationInterval: number;
  logConfig: LogConfig;
  serverConfigs: ServerConfig[];
  localOutputDir: string;
};

export const config: ConfigType = {
  incomingDir: conf.incomingDir,
  outgoingDir: conf.outgoingDir,
  cmdsInputDir: conf.cmdsInputDir,
  jobPollInterval: conf.jobPollInterval,
  inputFilesReconciliationInterval: conf.inputFilesReconciliationInterval,
  logConfig: conf.logConfig,
  serverConfigs: conf.serverConfigs,
  localOutputDir: conf.localOutputDir,
};

export function initDirectories() {
  mkdirSync(config.incomingDir, { recursive: true });
  mkdirSync(config.outgoingDir, { recursive: true });
  mkdirSync(config.cmdsInputDir, { recursive: true });
}
