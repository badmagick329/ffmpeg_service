import { JOB_STATUS } from "@/jobs";
import type { JobStatus } from "@/jobs";

const JobStatusColor = {
  [JOB_STATUS.RUNNING]: "blue",
  [JOB_STATUS.PENDING]: "yellow",
  [JOB_STATUS.SUCCEEDED]: "green",
  [JOB_STATUS.FAILED]: "red",
};

export function getJobStatusColor(status: JobStatus) {
  return JobStatusColor[status] || "white";
}
