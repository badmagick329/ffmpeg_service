import type { IJobsRepository } from "@/jobs/core/ijobs-repository";
import type { NewJob } from "@/jobs/core/job";
import { JOB_STATUS, type JobStatus } from "@/jobs/core/job-status";
import { jobsManager } from "@/infra/db";
import type { LoggerPort } from "@/common/logger-port";
import type { AppState, StatusCount } from "@/tui/lib/app-state";

export class JobsRepository implements IJobsRepository {
  private readonly _enqueue: typeof jobsManager.enqueue;
  private readonly _setSuccess: typeof jobsManager.setSuccess;
  private readonly _setFail: typeof jobsManager.setFail;
  private readonly _getJobIdWithLocalizedCmd: typeof jobsManager.getJobIdWithLocalizedCmd;
  private readonly _claim: typeof jobsManager.claim;
  private readonly _getStatusCount: typeof jobsManager.getStatusCount;

  private readonly appState: AppState;
  private readonly log: LoggerPort;

  constructor(appState: AppState, logger: LoggerPort) {
    this._enqueue = jobsManager.enqueue;
    this._setSuccess = jobsManager.setSuccess;
    this._setFail = jobsManager.setFail;
    this._getJobIdWithLocalizedCmd = jobsManager.getJobIdWithLocalizedCmd;
    this._claim = jobsManager.claim;
    this._getStatusCount = jobsManager.getStatusCount;

    this.appState = appState;
    this.log = logger.withContext({ service: "JobsRepository" });
  }
  setSuccess(jobId: number) {
    this._setSuccess.run({ $id: jobId });
    this.appState.batch(() => {
      this.appState.setCurrentJob(null);
      this.appState.updateJobStatusCount(this.getJobStatusCount());
    });
  }
  setFail(jobId: number): void {
    this._setFail.run({ $id: jobId });
    this.appState.batch(() => {
      this.appState.setCurrentJob(null);
      this.appState.updateJobStatusCount(this.getJobStatusCount());
    });
  }
  claim(): { id: number; localizedCmd: string } | null {
    const now = Date.now();
    const leaseUntil = now + 1000 * 60 * 60 * 3;
    const claimed = this._claim.get({
      // NOTE: only one worker per app for now
      $wid: 1,
      $lease: leaseUntil,
      $now: now,
    }) as
      | { id: number; localized_cmd: string; oldStatus: JobStatus }
      | undefined;
    if (claimed) {
      this.log.info(
        `Claimed job ID: ${claimed.id} leaseUntil: ${
          new Date(leaseUntil).toISOString().split("T")[0]
        }`,
        { jobId: claimed.id, leaseUntil }
      );
      this.appState.batch(() => {
        this.appState.setCurrentJob({
          id: claimed.id,
          command: claimed.localized_cmd,
          status: JOB_STATUS.RUNNING,
          startTime: now,
        });
        this.appState.updateJobStatus(
          claimed.localized_cmd,
          JOB_STATUS.RUNNING
        );
        this.appState.updateJobStatusCount(this.getJobStatusCount());
      });
    }
    return claimed
      ? { id: claimed.id, localizedCmd: claimed.localized_cmd }
      : null;
  }

  enqueueUnique(job: NewJob): { id: number } | null {
    const existing = this._getJobIdWithLocalizedCmd.get({
      $localized_cmd: job.localizedCmd,
    }) as { id: number } | undefined;
    if (existing) {
      return null;
    }

    const result = this._enqueue.get({
      $raw_cmd: job.rawCmd,
      $localized_cmd: job.localizedCmd,
      $input_file: job.inputFile,
      $status: JOB_STATUS.PENDING,
    }) as { id: number } | undefined;

    if (result) {
      this.appState.batch(() => {
        this.appState.setLastAddedJob({
          id: result.id,
          status: JOB_STATUS.PENDING,
          command: job.localizedCmd,
        });
        this.appState.updateJobStatusCount(this.getJobStatusCount());
      });
    }

    return result ? { id: result.id } : null;
  }

  getJobStatusCount(): StatusCount {
    const queryResult = this._getStatusCount.get() as {
      status: string;
      count: number;
    }[];

    const result = { pending: 0, running: 0, succeeded: 0, failed: 0 };
    for (const r of queryResult) {
      switch (r.status) {
        case JOB_STATUS.PENDING:
          result.pending = r.count;
          break;
        case JOB_STATUS.RUNNING:
          result.running = r.count;
          break;
        case JOB_STATUS.SUCCEEDED:
          result.succeeded = r.count;
          break;
        case JOB_STATUS.FAILED:
          result.failed = r.count;
          break;
      }
    }

    return result;
  }
}
