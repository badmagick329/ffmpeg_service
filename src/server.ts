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
import { AppState } from "@/tui/app-state";
import { start } from "@/tui/ui";

const appState = new AppState();
const logger = new WinstonLogger(config.logConfig, {}, appState);
const mainLogger = logger.withContext({ service: "Main" });

async function main() {
  mainLogger.info("Starting ffmpeg service...");
  initDirectories();
  const inputsRepo = new SQLInputFilesRepo();
  const jobsRepo = new JobsRepository(appState, logger);
  const jobProcessingService = new JobProcessingService(jobsRepo);
  const pathTranslator = new PathTranslator({
    src: config.incomingDir,
    dst: config.outgoingDir,
  });
  const cmdTranslator = new CmdTranslator(pathTranslator);

  startInputFilesWatcher(inputsRepo, config.inputFilesReconciliationInterval);
  startFsCommandsWatcher(cmdTranslator, jobsRepo);
  startFFmpegJobListener(
    cmdTranslator,
    jobProcessingService,
    config.jobPollInterval
  );
  start(appState);

  mainLogger.info("ffmpeg service started.");
}

function startInputFilesWatcher(
  inputsRepo: SQLInputFilesRepo,
  reconciliationInterval: number
) {
  const watchService = new InputFilesWatchService(
    inputsRepo,
    new FsWatcher(config.incomingDir),
    config.incomingDir,
    reconciliationInterval,
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
  jobProcessingService: JobProcessingService,
  pollInterval: number
) {
  const cmdRunner = new FFmpegCommandRunner(cmdTranslator, appState, logger);
  const ffmpegJobListener = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobProcessingService,
    pollInterval,
    logger
  );
  ffmpegJobListener.listen();
}

main();
