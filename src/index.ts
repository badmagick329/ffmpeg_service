import { CmdTranslator } from "@/core/translators/cmd-translator";
import { PathTranslator } from "@/core/translators/path-translator";
import { config } from "@/infra/config";
import { InputFilesRepository } from "@/infra/repositories/input-files-repository";
import { InputFilesWatchService } from "@/services/input-files-watch-service";
import { JobCreationService } from "@/services/job-creation-service";
import { JobsRepository } from "@/infra/repositories/jobs-repository";
import { FsCommandsWatchService } from "@/services/fs-commands-watch-service";
import { FsWatcher } from "@/infra/fs-watcher";
import { FFmpegCommandRunner } from "@/infra/ffmpeg-command-runner";
import { FFmpegJobListener } from "@/services/ffmpeg-job-listener";

async function main() {
  const inputsRepo = new InputFilesRepository();
  const jobsRepo = new JobsRepository();
  const pathTranslator = new PathTranslator({
    src: config.src,
    dst: config.dst,
  });
  const cmdTranslator = new CmdTranslator(pathTranslator);

  startInputFilesWatcher(inputsRepo, jobsRepo);
  startFsCommandsWatcher(cmdTranslator, inputsRepo, jobsRepo);
  startFFmpegJobListener(cmdTranslator, jobsRepo);
}

function startInputFilesWatcher(
  inputsRepo: InputFilesRepository,
  jobsRepo: JobsRepository
) {
  const watchService = new InputFilesWatchService(
    inputsRepo,
    jobsRepo,
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
  jobsRepo: JobsRepository
) {
  const cmdRunner = new FFmpegCommandRunner(cmdTranslator);
  const ffmpegJobListener = new FFmpegJobListener(
    cmdRunner,
    cmdTranslator,
    jobsRepo
  );
  ffmpegJobListener.listen();
}

main();
