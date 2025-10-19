import { JOB_STATUS } from "@/jobs";
import type { StatusCount } from "@/tui/app-state";
import { getJobStatusColor } from "@/tui/lib/job-status-color";
import { Box, Text } from "ink";

export default function JobStatusCount({
  statusCount,
}: {
  statusCount: StatusCount;
}) {
  return (
    <Box justifyContent="space-around" gap={2}>
      <Text color={getJobStatusColor(JOB_STATUS.PENDING)}>
        {JOB_STATUS.PENDING} {statusCount.pending}
      </Text>
      <Text color={getJobStatusColor(JOB_STATUS.RUNNING)}>
        {JOB_STATUS.RUNNING} {statusCount.running}
      </Text>
      <Text color={getJobStatusColor(JOB_STATUS.SUCCEEDED)}>
        {JOB_STATUS.SUCCEEDED} {statusCount.succeeded}
      </Text>
      <Text color={getJobStatusColor(JOB_STATUS.FAILED)}>
        {JOB_STATUS.FAILED} {statusCount.failed}
      </Text>
    </Box>
  );
}
