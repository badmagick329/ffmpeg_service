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
import { JobsRepository } from "./infra/repositories/jobs-repository";
import { JOB_STATUS } from "./core/job";

async function main() {
  // testRunner();
  testInputChecker();
  // testWatcher();
  // testJobCreationService();
}
function testJobCreationService() {
  const pathTranslator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const cmdTranslater = new CmdTranslater(pathTranslator);
  const inputRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();
  const jobCreationService = new JobCreationService(
    cmdTranslater,
    inputRepo,
    jobsRepo
  );
  // jobCreationService.enqueue(config.sampleCmd);
  jobCreationService.enqueueUnique(config.sampleCmd);
}

function testWatcher() {
  const makeWatcher: MakeWatcher = (onChange) =>
    FsWatcherBuilder.start()
      .watchPath("../data/incoming")
      .onChange(onChange)
      .build();

  const inputsRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();
  const watchService = new InputWatchService(inputsRepo, jobsRepo, makeWatcher);
  watchService.start();
}

async function testInputChecker() {
  const inputsRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();
  const testFile = "../data/incoming/120614 input.mkv";

  const result = inputsRepo.add(testFile);
  console.log("Added file:", result);
  if (result) {
    jobsRepo.changeStatusFrom(
      result.inputFile,
      JOB_STATUS.MISSING_INPUT,
      JOB_STATUS.PENDING
    );
  }
  console.log(inputsRepo.exists(testFile));
  prompt("Press Enter to remove the file...");
  inputsRepo.remove(testFile);
  console.log("File removed. Exists now?", inputsRepo.exists(testFile));
  jobsRepo.changeStatusFrom(
    testFile,
    JOB_STATUS.PENDING,
    JOB_STATUS.MISSING_INPUT
  );
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
