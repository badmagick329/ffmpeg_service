import { JOB_STATUS } from "@/jobs";
import type { JobInfo } from "@/tui/lib/app-state";
import { getJobStatusColor } from "@/tui/lib/job-status-color";
import { Box, Text } from "ink";
import { ScrollableList, useListItemWidth } from "ink-scrollable-list";

export default function RecentlyAddedJobs({ jobs }: { jobs: JobInfo[] }) {
  const safeWidth = useListItemWidth(true, "round");
  if (jobs.length === 0) return;

  return (
    <Box flexDirection="column">
      <Text bold underline color="yellowBright">
        Recently Added Jobs:
      </Text>
      <ScrollableList
        key={jobs.length}
        items={jobs}
        visibleCount={5}
        startAtBottom={true}
        renderItem={(job) => {
          const dateTime = new Date(job.createdAt)
            .toISOString()
            .split(".")[0]!
            .replace("T", " ");
          let trimmedCommand = job.command.slice(
            -(safeWidth - job.status.length - 5 - dateTime.length)
          );
          if (trimmedCommand.length !== job.command.length) {
            trimmedCommand = "…" + trimmedCommand;
          }

          return (
            <Box gap={1}>
              <Text dimColor>{dateTime}</Text>
              <Text bold color={getJobStatusColor(job.status)}>
                {job.status}
              </Text>
              <Text>{trimmedCommand}</Text>
            </Box>
          );
        }}
      />
    </Box>
  );
}
