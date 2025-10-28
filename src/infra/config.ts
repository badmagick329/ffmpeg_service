import type { LogConfig } from "@/common/logger-port";
import conf from "../../config.toml";
import { mkdirSync } from "fs";

export type ServerConfig = {
  sshHost: string;
  sshUser: string;
  sshKeyPath?: string;
  remoteWorkDir: string;
  remoteCmdsDir: string;
  remoteSuccessDir: string;
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
  clientStateFile: string;
  successDir: string;
};

export const config: ConfigType = {
  incomingDir: conf.incomingDir,
  outgoingDir: conf.outgoingDir,
  cmdsInputDir: conf.cmdsInputDir,
  jobPollInterval: conf.jobPollInterval,
  inputFilesReconciliationInterval: conf.inputFilesReconciliationInterval,
  logConfig: conf.logConfig,
  serverConfigs: conf.serverConfigs,
  clientStateFile: conf.clientStateFile,
  successDir: conf.successDir,
};

export function initDirectories() {
  mkdirSync(config.incomingDir, { recursive: true });
  mkdirSync(config.outgoingDir, { recursive: true });
  mkdirSync(config.cmdsInputDir, { recursive: true });
}
