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

async function main() {
  const logger = new WinstonLogger(config.logConfig);
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
}

function startInputFilesWatcher(inputsRepo: SQLInputFilesRepo) {
  const watchService = new InputFilesWatchService(
    inputsRepo,
    new FsWatcher(config.incomingDir),
    config.incomingDir
  );
  console.log(`[Main] - Input watcher is watching: ${config.incomingDir}`);
  watchService.start();
}

function startFsCommandsWatcher(
  cmdTranslator: CmdTranslator,
  jobsRepo: JobsRepository
) {
  const jobCreationService = new JobCreationService(cmdTranslator, jobsRepo);

  const fileCommandsWatcher = new FsCommandsWatchService(
    jobCreationService,
    new FsWatcher(config.cmdsInputDir)
  );
  console.log(`[Main] - Command watcher is watching: ${config.cmdsInputDir}`);
  fileCommandsWatcher.start();
}

function startFFmpegJobListener(
  cmdTranslator: CmdTranslator,
  jobProcessingService: JobProcessingService
) {
  const cmdRunner = new FFmpegCommandRunner(cmdTranslator);
  const ffmpegJobListener = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobProcessingService
  );
  ffmpegJobListener.listen();
}

main();
