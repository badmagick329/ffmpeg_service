import { CmdTranslater } from "./core/cmd-translator";
import { PathTranslator } from "./core/path-translator";
import { FFmpegCommandRunner } from "./infra/ffmpeg-command-runner";
import { config } from "./infra/config";
import { RunnerService } from "./services/runner-service";
import { InputFilesRepository } from "./infra/repositories/input-files-repository";
import { FsWatcherBuilder } from "./infra/fs-watcher-builder";
import { InputWatchService } from "./services/input-watch-service";
import type { MakeWatcher } from "./core/ifs-watcher";
import { JobCreationService } from "./services/job-creation-service";
import { ParsedCmd } from "./core/parsed-cmd";

async function main() {
  // testRunner();
  // testInputChecker();
  // testWatcher();
  testJobCreationService();
}
function testJobCreationService() {
  const pathTranslator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const cmdTranslater = new CmdTranslater(pathTranslator);
  const inputRepo = new InputFilesRepository();
  // const jobCreationService = new JobCreationService(
  //   cmdTranslater,
  //   inputRepo,
  //   {}
  // );
  // jobCreationService.enqueue(config.sampleCmd);
}

function testWatcher() {
  const makeWatcher: MakeWatcher = (onChange) =>
    FsWatcherBuilder.start()
      .watchPath("../data/incoming")
      .onChange(onChange)
      .build();

  const inputRepo = new InputFilesRepository();
  const watchService = new InputWatchService(inputRepo, makeWatcher);
  watchService.start();
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
  const cmdTranslator = new CmdTranslater(translator);
  // testing localize
  const parsedSample = ParsedCmd.create(config.sampleCmd);
  console.log(cmdTranslator.localizeCmd(parsedSample));

  const cmdRunner = new FFmpegCommandRunner(cmdTranslator);
  const runner = new RunnerService(cmdRunner, cmdTranslator);

  // simulating run
  const result = await runner.run({
    cmd: config.sampleCmd,
    debug: true,
  });
  console.log("Command executed with result:", result);
}

main();
