import { JOB_STATUS } from "@/jobs";
import type { JobInfo } from "@/tui/app-state";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";

export default function JobDisplay({ job }: { job: JobInfo }) {
  const [timeDelta, setTimeDelta] = useState("");

  useEffect(() => {
    if (!job.startTime || job.status !== JOB_STATUS.RUNNING) {
      return;
    }

    const interval = setInterval(() => {
      setTimeDelta(humanReadableTimeDelta(job.startTime!));
    }, 1000);

    return () => clearInterval(interval);
  }, [job.startTime, job.status]);

  let statusColor = "white";
  if (job.status === JOB_STATUS.RUNNING) {
    statusColor = "yellow";
  } else if (job.status === JOB_STATUS.PENDING) {
    statusColor = "blue";
  } else if (job.status === JOB_STATUS.SUCCEEDED) {
    statusColor = "green";
  } else if (job.status === JOB_STATUS.FAILED) {
    statusColor = "red";
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text bold>Status</Text>
        <Text>-</Text>
        <Text bold color={statusColor}>
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
  let humanReadableDifference = null;

  if (delta > 1000 * 60 * 60) {
    humanReadableDifference = `${Math.round(delta / (1000 * 60 * 60))}h ago`;
  } else if (delta > 1000 * 60) {
    humanReadableDifference = `${Math.round(delta / (1000 * 60))}m ago`;
  } else {
    humanReadableDifference = `${Math.round(delta / 1000)}s ago`;
  }

  return humanReadableDifference;
}
