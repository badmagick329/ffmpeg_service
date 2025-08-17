import { CmdConverter } from "./core/cmdConverter";
import { PathTranslator } from "./core/pathTranslator";
import { CmdRunner } from "./infra/cmd_runner";
import { config } from "./infra/config";

async function main() {
  const translator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const converter = new CmdConverter(translator);

  const runner = new CmdRunner(converter);
  const result = await runner.run({
    cmd: config.sampleCmd,
    debug: false,
  });
  console.log("Command executed with result:", result);
}

main();
