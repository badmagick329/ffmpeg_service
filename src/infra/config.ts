import type { LogConfig } from "@/common/logger-port";
import conf from "../../config.toml";
import { mkdirSync } from "fs";

const DEFAULTS = {
  incomingDir: "./work/videos",
  outgoingDir: "./work/videos_out",
  successDir: "./work/success",
  jobPollInterval: 10000,
  cmdsInputDir: "./data/cmds",
  logConfig: {
    logLevel: "info",
    logDir: "./logs",
  },
  clientStateFile: "./client-state.json",
  pauseWatchFlag: "incoming",
  successFlag: "done",
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

// Raw inputs from TOML:
if (
  !conf.client?.remotes ||
  !Array.isArray(conf.client.remotes) ||
  conf.client.remotes.length === 0
) {
  throw new Error(
    "Missing required 'client.remotes' array in config.toml. Please define at least one remote server."
  );
}

export const config: ConfigType = {
  // Server
  incomingDir: conf.server.incomingDir ?? DEFAULTS.incomingDir,
  outgoingDir: conf.server.outgoingDir ?? DEFAULTS.outgoingDir,
  successDir: conf.server.successDir ?? DEFAULTS.successDir,
  jobPollInterval: conf.server.jobPollInterval ?? DEFAULTS.jobPollInterval,
  // Shared
  cmdsInputDir: conf.shared.cmdsInputDir ?? DEFAULTS.cmdsInputDir,
  logConfig: conf.shared.logConfig ?? DEFAULTS.logConfig,
  // Client
  remoteConfigs: conf.client.remotes, // <- REQUIRED IN CONFIG
  clientStateFile: conf.client.stateFile ?? DEFAULTS.clientStateFile,
  pauseWatchFlag: conf.client.pauseWatchFlag ?? DEFAULTS.pauseWatchFlag,
  successFlag: conf.client.successFlag ?? DEFAULTS.successFlag,
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

function validateRemoteConfigs(configs: RemoteConfig[]): void {
  const names = new Set<string>();
  const ips = new Set<string>();

  for (const config of configs) {
    if (!config.serverName || config.serverName.trim() === "") {
      throw new Error(
        `Remote config missing remoteName (IP: ${config.sshHostIP})`
      );
    }

    if (names.has(config.serverName)) {
      throw new Error(`Duplicate remoteName: ${config.serverName}`);
    }
    names.add(config.serverName);

    if (!/^[a-zA-Z0-9_-]+$/.test(config.serverName)) {
      throw new Error(
        `Invalid remoteName "${config.serverName}": must contain only letters, numbers, hyphens, and underscores`
      );
    }

    if (ips.has(config.sshHostIP)) {
      console.warn(`⚠️  Warning: Duplicate sshHostIP: ${config.sshHostIP}`);
    }
    ips.add(config.sshHostIP);
  }
}

populateDefaults();
validateRemoteConfigs(config.remoteConfigs);

export function initDirectories() {
  mkdirSync(config.incomingDir, { recursive: true });
  mkdirSync(config.outgoingDir, { recursive: true });
  mkdirSync(config.cmdsInputDir, { recursive: true });
}
