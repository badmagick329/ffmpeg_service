import type { LogConfig } from "@/common/logger-port";
import conf from "../../config.toml";
import { mkdirSync } from "fs";

export type ServerConfig = {
  serverName: string; // Human-friendly identifier (required, must be unique)
  sshHostIP: string; // IP address or hostname that resolves via DNS
  sshUser: string;
  sshKeyPath: string;
  remoteWorkDir: string;
  remoteCmdsDir: string;
  remoteSuccessDir: string;
  pauseWatchFlagFile: string;
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
  pauseWatchFlag: string;
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
  pauseWatchFlag: conf.pauseWatchFlag || "incoming",
};

function populateDefaults() {
  config.serverConfigs.forEach((s) => {
    if (!s.pauseWatchFlagFile) {
      s.pauseWatchFlagFile = `${s.copyTo}/${config.pauseWatchFlag}`;
    }
  });
}

function validateServerConfigs(configs: ServerConfig[]): void {
  const names = new Set<string>();
  const ips = new Set<string>();

  for (const config of configs) {
    if (!config.serverName || config.serverName.trim() === "") {
      throw new Error(
        `Server config missing serverName (IP: ${config.sshHostIP})`
      );
    }

    if (names.has(config.serverName)) {
      throw new Error(`Duplicate serverName: ${config.serverName}`);
    }
    names.add(config.serverName);

    if (!/^[a-zA-Z0-9_-]+$/.test(config.serverName)) {
      throw new Error(
        `Invalid serverName "${config.serverName}": must contain only letters, numbers, hyphens, and underscores`
      );
    }

    if (ips.has(config.sshHostIP)) {
      console.warn(`⚠️  Warning: Duplicate sshHostIP: ${config.sshHostIP}`);
    }
    ips.add(config.sshHostIP);
  }
}

populateDefaults();
validateServerConfigs(config.serverConfigs);

export function initDirectories() {
  mkdirSync(config.incomingDir, { recursive: true });
  mkdirSync(config.outgoingDir, { recursive: true });
  mkdirSync(config.cmdsInputDir, { recursive: true });
}
