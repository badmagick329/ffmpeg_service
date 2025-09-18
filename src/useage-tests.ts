import {
  CmdTranslator,
  ParsedCmd,
  PathTranslator,
} from "@/command-translation";
import { config } from "@/infra/config";
import { InputFilesRepository, InputFilesWatchService } from "@/file-ingestion";
import {
  JobCreationService,
  JobProcessingService,
  JobsRepository,
} from "@/jobs";
import { FFmpegCommandRunner, FFmpegJobListener } from "@/ffmpeg-job-listener";
import { FsWatcher } from "@/fs-watcher";

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
  const jobProcessingService = new JobProcessingService(jobsRepo);
  const ffmpegWatcher = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobProcessingService
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
  const jobsRepo = new JobsRepository();
  const jobCreationService = new JobCreationService(cmdTranslator, jobsRepo);
  // jobCreationService.enqueue(config.sampleCmd);
  jobCreationService.enqueueUnique(config.sampleCmd);
}

function testWatcher() {
  const inputsRepo = new InputFilesRepository();
  const watchService = new InputFilesWatchService(
    inputsRepo,
    new FsWatcher("./data/incoming")
  );
  watchService.start();
}

async function testInputChecker() {
  const inputsRepo = new InputFilesRepository();

  const result = inputsRepo.add(config.sampleInput);
  console.log("Added file:", result);
  console.log(inputsRepo.exists(config.sampleInput));
  prompt("Press Enter to remove the file...");
  inputsRepo.remove(config.sampleInput);
  console.log(
    "File removed. Exists now?",
    inputsRepo.exists(config.sampleInput)
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
  const jobProcessingService = new JobProcessingService(jobsRepo);
  const ffmpegWatcher = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobProcessingService
  );

  // simulating run
  const result = await ffmpegWatcher.execute({
    cmd: config.sampleCmd,
    debug: true,
  });
  console.log("Command executed with result:", result);
}

main();
