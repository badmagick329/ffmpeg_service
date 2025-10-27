import { CmdTranslator, PathTranslator } from "@/command-translation";
import { config, initDirectories } from "@/infra/config";
import { SQLInputFilesRepo, InputFilesWatchService } from "@/file-ingestion";
import {
  JobCreationService,
  JobLifecycleService,
  JobsRepository,
} from "@/jobs";
import {
  FFmpegCommandRunner,
  FsCommandsWatchService,
  FFmpegJobExecutor,
} from "@/ffmpeg-job-executor";
import { FsWatcher } from "@/fs-watcher";
import { WinstonLogger } from "@/infra/winston-logger";
import { AppState } from "@/tui/lib/app-state";
import { start } from "@/tui/ui";

const appState = new AppState();
const logger = new WinstonLogger(config.logConfig, {}, appState);
const mainLogger = logger.withContext({ service: "Main" });

async function main() {
  mainLogger.info("Starting ffmpeg service");
  initDirectories();
  const inputsRepo = new SQLInputFilesRepo();
  const jobsRepo = new JobsRepository(appState, logger);
  const jobLifecycleService = new JobLifecycleService(jobsRepo);
  const pathTranslator = new PathTranslator({
    src: config.incomingDir,
    dst: config.outgoingDir,
  });
  const cmdTranslator = new CmdTranslator(pathTranslator);

  startInputFilesWatcher(inputsRepo, config.inputFilesReconciliationInterval);
  startFsCommandsWatcher(cmdTranslator, jobsRepo);
  startFFmpegJobExecutor(
    cmdTranslator,
    jobLifecycleService,
    config.jobPollInterval,
    config.successDir
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

function startFFmpegJobExecutor(
  cmdTranslator: CmdTranslator,
  jobLifecycleService: JobLifecycleService,
  pollInterval: number,
  successDir: string
) {
  const cmdRunner = new FFmpegCommandRunner(cmdTranslator, appState, logger);
  const ffmpegJobExecutor = new FFmpegJobExecutor(
    cmdRunner,
    cmdTranslator,
    jobLifecycleService,
    pollInterval,
    successDir,
    logger
  );
  ffmpegJobExecutor.start();
}

main();
