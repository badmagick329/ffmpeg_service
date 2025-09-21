import conf from "../../config.toml";

type ConfigType = {
  src: string;
  dst: string;
  cmdsInputDir: string;
};

export const config: ConfigType = {
  src: conf.src,
  dst: conf.dst,
  cmdsInputDir: conf.cmdsInputDir,
};
