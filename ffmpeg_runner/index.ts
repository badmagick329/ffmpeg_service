import { CmdConverter } from "./core/cmd-converter";
import { PathTranslator } from "./core/path-translator";
import { FFmpegCommandRunner } from "./infra/ffmpeg-command-runner";
import { config } from "./infra/config";
import { RunnerService } from "./services/runner-service";
import { InputFilesRepository } from "./infra/repositories/input-files-repository";

async function main() {
  // testRunner();
  testInputChecker();
}

async function testInputChecker() {
  const repo = new InputFilesRepository();
  const testFile = "../data/incoming/file.mp4";
  const result = repo.add(testFile);
  console.log("Added file:", result);
  console.log(repo.exists(testFile));
}

async function testRunner() {
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
