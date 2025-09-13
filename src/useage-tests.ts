import {
  CmdTranslator,
  ParsedCmd,
  PathTranslator,
} from "@/command-translation";
import { config } from "@/infra/config";
import {
  InputFilesRepository,
  InputFilesWatchService,
  FsWatcher,
} from "@/file-ingestion";
import {
  JOB_STATUS,
  JobCreationService,
  JobProcessingService,
  JobsRepository,
} from "@/jobs";
import { FFmpegCommandRunner, FFmpegJobListener } from "@/ffmpeg-job-listener";

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
  const jobProcessingService = new JobProcessingService(jobsRepo);
  const watchService = new InputFilesWatchService(
    inputsRepo,
    jobProcessingService,
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
