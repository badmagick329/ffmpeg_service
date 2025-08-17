import conf from "../config.toml";

type ConfigType = {
  src: string;
  dst: string;
  sampleCmd: string;
};

export const config: ConfigType = {
  src: conf.src,
  dst: conf.dst,
  sampleCmd: conf.sampleCmd,
};
