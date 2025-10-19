import type { IJobsRepository } from "@/jobs/core/ijobs-repository";
import type { Job } from "@/jobs/core/job";
import { JOB_STATUS, type JobStatus } from "@/jobs/core/job-status";
import { jobsManager } from "@/infra/db";
import type { LoggerPort } from "@/common/logger-port";
import type { AppState } from "@/tui/app-state";

export class JobsRepository implements IJobsRepository {
  private readonly _enqueue: typeof jobsManager.enqueue;
  private readonly _setSuccess: typeof jobsManager.setSuccess;
  private readonly _setFail: typeof jobsManager.setFail;
  private readonly _setRunning: typeof jobsManager.setRunning;
  private readonly _getJobIdWithLocalizedCmd: typeof jobsManager.getJobIdWithLocalizedCmd;
  private readonly _claim: typeof jobsManager.claim;

  private readonly appState: AppState;
  private readonly log: LoggerPort;

  constructor(appState: AppState, logger: LoggerPort) {
    this._enqueue = jobsManager.enqueue;
    this._setSuccess = jobsManager.setSuccess;
    this._setFail = jobsManager.setFail;
    this._setRunning = jobsManager.setRunning;
    this._getJobIdWithLocalizedCmd = jobsManager.getJobIdWithLocalizedCmd;
    this._claim = jobsManager.claim;

    this.appState = appState;
    this.log = logger.withContext({ service: "JobsRepository" });
  }
  setSuccess(jobId: number) {
    this._setSuccess.run({ $id: jobId });
    this.appState.setCurrentJob(null);
  }
  setFail(jobId: number): void {
    this._setFail.run({ $id: jobId });
    this.appState.setCurrentJob(null);
  }
  setRunning(jobId: number): void {
    this._setRunning.run({ $id: jobId });
  }

  claim(): { id: number; localizedCmd: string } | null {
    const now = Date.now();
    const leaseUntil = now + 1000 * 60 * 60 * 3;
    const claimed = this._claim.get({
      // NOTE: only one worker per app for now
      $wid: 1,
      $lease: leaseUntil,
      $now: now,
    }) as { id: number; localized_cmd: string } | undefined;
    if (claimed) {
      this.log.info(
        `Claimed job ID: ${claimed.id} leaseUntil: ${
          new Date(leaseUntil).toISOString().split("T")[0]
        }`,
        { jobId: claimed.id, leaseUntil }
      );
      this.appState.setCurrentJob({
        id: claimed.id,
        command: claimed.localized_cmd,
        status: JOB_STATUS.RUNNING,
        startTime: now,
      });
      this.appState.updateJobStatus(claimed.localized_cmd, JOB_STATUS.RUNNING);
    }
    return claimed
      ? { id: claimed.id, localizedCmd: claimed.localized_cmd }
      : null;
  }

  enqueueUnique(job: Job): { id: number } | null {
    const existing = this._getJobIdWithLocalizedCmd.get({
      $localized_cmd: job.localizedCmd,
    }) as { id: number } | undefined;
    if (existing) {
      return null;
    }

    return this.enqueue(job);
  }

  enqueue(job: Job): { id: number } | null {
    const result = this._enqueue.get({
      $raw_cmd: job.rawCmd,
      $localized_cmd: job.localizedCmd,
      $input_file: job.inputFile,
      $status: job.status,
    }) as { id: number } | undefined;

    if (result) {
      this.appState.setLastAddedJob({
        id: result.id,
        status: job.status,
        command: job.localizedCmd,
      });
    }

    return result ? { id: result.id } : null;
  }
}
