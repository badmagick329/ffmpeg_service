import { CmdTranslator } from "@/core/translators/cmd-translator";
import { PathTranslator } from "@/core/translators/path-translator";
import { FFmpegCommandRunner } from "@/infra/ffmpeg-command-runner";
import { config } from "@/infra/config";
import { FFmpegJobListener } from "@/services/ffmpeg-job-listener";
import { InputFilesRepository } from "@/infra/repositories/input-files-repository";
import { InputFilesWatchService } from "@/services/input-files-watch-service";
import { JobCreationService } from "@/services/job-creation-service";
import { ParsedCmd } from "@/core/models/parsed-cmd";
import { JobsRepository } from "@/infra/repositories/jobs-repository";
import { JOB_STATUS } from "@/core/models/job";
import { FsWatcher } from "@/infra/fs-watcher";

async function main() {
  // testRunner();
  // testInputChecker();
  testWatcher();
  // testJobCreationService();
  // testFFmpegListener();
}

async function testFFmpegListener() {
  const translator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const cmdTranslator = new CmdTranslator(translator);

  const cmdRunner = new FFmpegCommandRunner(cmdTranslator);
  const jobsRepo = new JobsRepository();
  const ffmpegWatcher = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobsRepo
  );

  console.log("Starting FFmpeg job listener...");
  await ffmpegWatcher.listen();
}

function testJobCreationService() {
  const pathTranslator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const cmdTranslator = new CmdTranslator(pathTranslator);
  const inputRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();
  const jobCreationService = new JobCreationService(
    cmdTranslator,
    inputRepo,
    jobsRepo
  );
  // jobCreationService.enqueue(config.sampleCmd);
  jobCreationService.enqueueUnique(config.sampleCmd);
  // Assuming the input file exists
  jobsRepo.changeStatusFrom(
    config.sampleInput,
    JOB_STATUS.MISSING_INPUT,
    JOB_STATUS.PENDING
  );
}

function testWatcher() {
  const inputsRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();
  const watchService = new InputFilesWatchService(
    inputsRepo,
    jobsRepo,
    new FsWatcher("./data/incoming")
  );
  watchService.start();
}

async function testInputChecker() {
  const inputsRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();

  const result = inputsRepo.add(config.sampleInput);
  console.log("Added file:", result);
  if (result) {
    jobsRepo.changeStatusFrom(
      result.inputFile,
      JOB_STATUS.MISSING_INPUT,
      JOB_STATUS.PENDING
    );
  }
  console.log(inputsRepo.exists(config.sampleInput));
  prompt("Press Enter to remove the file...");
  inputsRepo.remove(config.sampleInput);
  console.log(
    "File removed. Exists now?",
    inputsRepo.exists(config.sampleInput)
  );
  jobsRepo.changeStatusFrom(
    config.sampleInput,
    JOB_STATUS.PENDING,
    JOB_STATUS.MISSING_INPUT
  );
}

async function testRunner() {
  const translator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const cmdTranslator = new CmdTranslator(translator);
  // testing localize
  const parsedSample = ParsedCmd.create(config.sampleCmd);
  console.log(cmdTranslator.localizeCmd(parsedSample));

  const cmdRunner = new FFmpegCommandRunner(cmdTranslator);
  const jobsRepo = new JobsRepository();
  const ffmpegWatcher = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobsRepo
  );

  // simulating run
  const result = await ffmpegWatcher.execute({
    cmd: config.sampleCmd,
    debug: true,
  });
  console.log("Command executed with result:", result);
}

main();
