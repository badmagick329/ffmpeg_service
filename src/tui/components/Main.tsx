import { APP_EVENT_TYPE, type AppState, type JobInfo } from "@/tui/app-state";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import JobDisplay from "@/tui/components/JobDisplay";
import RecentEvents from "@/tui/components/RecentEvents";

export default function Main({ appState }: { appState: AppState }) {
  const [state, setState] = useState(appState.getState());

  useEffect(() => {
    const handler = () => setState(appState.getState());
    appState.on(APP_EVENT_TYPE.CHANGE, handler);
    return () => {
      appState.off(APP_EVENT_TYPE.CHANGE, handler);
    };
  }, [appState]);

  return (
    <Box flexDirection="column" gap={1}>
      <RecentEvents appEvents={state.recentEvents} />
      <CurrentJob job={state.currentJob} />
      <LastAddedJob job={state.lastAddedJob} />
    </Box>
  );
}

function CurrentJob({ job }: { job: JobInfo | null }) {
  if (!job) return;

  return (
    <Box flexDirection="column">
      <Text bold underline color="greenBright">
        Current Job:
      </Text>
      <JobDisplay job={job} />
    </Box>
  );
}

function LastAddedJob({ job }: { job: JobInfo | null }) {
  if (!job) return;

  return (
    <Box flexDirection="column">
      <Text bold underline color="yellowBright">
        Last Added Job:
      </Text>
      <JobDisplay job={job} />
    </Box>
  );
}
