import { CmdTranslator, PathTranslator } from "@/command-translation";
import { config } from "@/infra/config";
import {
  InputFilesRepository,
  InputFilesWatchService,
  FsWatcher,
} from "@/file-ingestion";
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

async function main() {
  const inputsRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();
  const jobProcessingService = new JobProcessingService(jobsRepo);
  const pathTranslator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const cmdTranslator = new CmdTranslator(pathTranslator);

  startInputFilesWatcher(inputsRepo);
  startFsCommandsWatcher(cmdTranslator, jobsRepo);
  startFFmpegJobListener(cmdTranslator, jobProcessingService);
}

function startInputFilesWatcher(inputsRepo: InputFilesRepository) {
  const watchService = new InputFilesWatchService(
    inputsRepo,
    new FsWatcher(config.src)
  );
  console.log(`[Main] - Input watcher is watching: ${config.src}`);
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
