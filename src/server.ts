import { CmdTranslator, PathTranslator } from "@/command-translation";
import { config, initDirectories } from "@/infra/config";
import { SQLInputFilesRepo, InputFilesWatchService } from "@/file-ingestion";
import {
  JobCreationService,
  JobProcessingService,
  JobsRepository,
} from "@/jobs";
import {
  FFmpegCommandRunner,
  FsCommandsWatchService,
  FFmpegJobListener,
} from "@/ffmpeg-job-listener";
import { FsWatcher } from "@/fs-watcher";
import { WinstonLogger } from "@/infra/winston-logger";

const logger = new WinstonLogger(config.logConfig);
const mainLogger = logger.withContext({ service: "Main" });

async function main() {
  console.log("[Main] - Starting ffmpeg service...");
  mainLogger.info("Starting ffmpeg service...");
  initDirectories();

  const inputsRepo = new SQLInputFilesRepo();
  const jobsRepo = new JobsRepository(logger);
  const jobProcessingService = new JobProcessingService(jobsRepo);
  const pathTranslator = new PathTranslator({
    src: config.incomingDir,
    dst: config.outgoingDir,
  });
  const cmdTranslator = new CmdTranslator(pathTranslator);

  startInputFilesWatcher(inputsRepo);
  startFsCommandsWatcher(cmdTranslator, jobsRepo);
  startFFmpegJobListener(cmdTranslator, jobProcessingService);
  console.log("[Main] - ffmpeg service started.");
  mainLogger.info("ffmpeg service started.");
}

function startInputFilesWatcher(inputsRepo: SQLInputFilesRepo) {
  const watchService = new InputFilesWatchService(
    inputsRepo,
    new FsWatcher(config.incomingDir),
    config.incomingDir,
    logger
  );
  mainLogger.info("Starting input files watcher", {
    watchDir: config.incomingDir,
  });
  watchService.start();
}

function startFsCommandsWatcher(
  cmdTranslator: CmdTranslator,
  jobsRepo: JobsRepository
) {
  const jobCreationService = new JobCreationService(
    cmdTranslator,
    jobsRepo,
    logger
  );

  const fileCommandsWatcher = new FsCommandsWatchService(
    jobCreationService,
    new FsWatcher(config.cmdsInputDir),
    logger
  );
  mainLogger.info("Starting command files watcher", {
    watchDir: config.cmdsInputDir,
  });
  fileCommandsWatcher.start();
}

function startFFmpegJobListener(
  cmdTranslator: CmdTranslator,
  jobProcessingService: JobProcessingService
) {
  const cmdRunner = new FFmpegCommandRunner(cmdTranslator, logger);
  const ffmpegJobListener = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobProcessingService,
    logger
  );
  ffmpegJobListener.listen();
}

main();
