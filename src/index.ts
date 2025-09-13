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

  startInputFilesWatcher(inputsRepo, jobProcessingService);
  startFsCommandsWatcher(cmdTranslator, inputsRepo, jobsRepo);
  startFFmpegJobListener(cmdTranslator, jobProcessingService);
}

function startInputFilesWatcher(
  inputsRepo: InputFilesRepository,
  jobProcessingService: JobProcessingService
) {
  const watchService = new InputFilesWatchService(
    inputsRepo,
    jobProcessingService,
    new FsWatcher(config.src)
  );
  console.log(`[Main] - Input watcher is watching: ${config.src}`);
  watchService.start();
}

function startFsCommandsWatcher(
  cmdTranslator: CmdTranslator,
  inputsRepo: InputFilesRepository,
  jobsRepo: JobsRepository
) {
  const jobCreationService = new JobCreationService(
    cmdTranslator,
    inputsRepo,
    jobsRepo
  );

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
