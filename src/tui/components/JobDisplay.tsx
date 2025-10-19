import { JOB_STATUS } from "@/jobs";
import type { JobInfo } from "@/tui/lib/app-state";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { getJobStatusColor } from "@/tui/lib/job-status-color";

export default function JobDisplay({ job }: { job: JobInfo }) {
  const [timeDelta, setTimeDelta] = useState("");

  useEffect(() => {
    if (!job.startTime || job.status !== JOB_STATUS.RUNNING) {
      return;
    }

    const interval = setInterval(() => {
      setTimeDelta(humanReadableTimeDelta(job.startTime!));
    }, 1000 * 60);

    return () => clearInterval(interval);
  }, [job.startTime, job.status]);

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text bold>Status</Text>
        <Text>-</Text>
        <Text bold color={getJobStatusColor(job.status)}>
          {job.status}
        </Text>
      </Box>
      <Text>{job.command}</Text>
      {timeDelta && <Text>Started {timeDelta}</Text>}
    </Box>
  );
}

function humanReadableTimeDelta(startTime: number): string {
  const now = Date.now();
  const delta = now - startTime;

  if (delta > 1000 * 60 * 60) {
    return `${Math.round(delta / (1000 * 60 * 60))}h ago`;
  }
  if (delta > 1000 * 60) {
    return `${Math.round(delta / (1000 * 60))}m ago`;
  }

  return `less than a min ago`;
}
