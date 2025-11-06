import type { LogConfig } from "@/common/logger-port";
import conf from "../../config.toml";
import { mkdirSync } from "fs";

const FLAGS = {
  success: "done",
  incoming: "incoming",
} as const;

export type RemoteConfig = {
  serverName: string; // Human-friendly identifier (required, must be unique)
  sshHostIP: string; // IP address or hostname that resolves via DNS
  sshUser: string;
  sshKeyPath: string;
  remoteWorkDir: string;
  remoteCmdsDir: string;
  remoteSuccessDir: string;
  successFlag: string;
  pauseWatchFlagFile: string;
  copyTo: string;
  copyFrom: string;
};

type ConfigType = {
  incomingDir: string;
  outgoingDir: string;
  cmdsInputDir: string;
  jobPollInterval: number;
  logConfig: LogConfig;
  remoteConfigs: RemoteConfig[];
  clientStateFile: string;
  successDir: string;
  pauseWatchFlag: string;
  successFlag: string;
};

export const config: ConfigType = {
  incomingDir: conf.incomingDir,
  outgoingDir: conf.outgoingDir,
  cmdsInputDir: conf.cmdsInputDir,
  jobPollInterval: conf.jobPollInterval,
  logConfig: conf.logConfig,
  remoteConfigs: conf.client.remotes,
  clientStateFile: conf.client.stateFile,
  successDir: conf.successDir,
  pauseWatchFlag: conf.pauseWatchFlag || FLAGS.incoming,
  successFlag: FLAGS.success,
};

function populateDefaults() {
  config.remoteConfigs.forEach((s) => {
    const splitter = s.copyTo.includes("\\") ? "\\" : "/";
    if (!s.pauseWatchFlagFile) {
      s.pauseWatchFlagFile = `${s.copyTo}${splitter}${config.pauseWatchFlag}`;
    }
    if (!s.successFlag) {
      s.successFlag = config.successFlag;
    }
  });
}

function validateServerConfigs(configs: RemoteConfig[]): void {
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
validateServerConfigs(config.remoteConfigs);

export function initDirectories() {
  mkdirSync(config.incomingDir, { recursive: true });
  mkdirSync(config.outgoingDir, { recursive: true });
  mkdirSync(config.cmdsInputDir, { recursive: true });
}
