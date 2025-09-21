import conf from "../../config.toml";

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
