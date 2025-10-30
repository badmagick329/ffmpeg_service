import { JOB_STATUS } from "@/jobs";
import type { JobInfo } from "@/tui/lib/app-state";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { getJobStatusColor } from "@/tui/lib/job-status-color";
import { humanReadableTimeDelta } from "@/tui/lib/utils";

export default function JobDisplay({ job }: { job: JobInfo }) {
  const [timeDelta, setTimeDelta] = useState("");

  useEffect(() => {
    if (!job.startTime || job.status !== JOB_STATUS.RUNNING) {
      return;
    }

    const interval = setInterval(() => {
      setTimeDelta(humanReadableTimeDelta(job.startTime!));
    }, 1000 * 60);
    if (timeDelta === "") {
      setTimeDelta(humanReadableTimeDelta(job.startTime!));
    }

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
      {timeDelta && (
        <Box gap={1}>
          <Text>Started</Text>
          <Text color={"yellow"}>{timeDelta}</Text>
        </Box>
      )}
    </Box>
  );
}
