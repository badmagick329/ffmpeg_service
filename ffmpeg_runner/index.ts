import { CmdConverter } from "./core/cmdConverter";
import { PathTranslator } from "./core/pathTranslator";
import { FFmpegCommandRunner } from "./infra/ffmpeg-command-runner";
import { config } from "./infra/config";
import { RunnerService } from "./services/runner-service";

async function main() {
  const translator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const converter = new CmdConverter(translator);

  const cmdRunner = new FFmpegCommandRunner(converter);
  const runner = new RunnerService(cmdRunner);

  // simulating run
  const result = await runner.run({
    cmd: config.sampleCmd,
    debug: false,
  });
  console.log("Command executed with result:", result);
}

main();
