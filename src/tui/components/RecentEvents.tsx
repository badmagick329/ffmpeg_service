import type { AppEvent } from "@/tui/lib/app-state";
import { Box, Text } from "ink";

const getLevelColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case "error":
      return "red";
    case "warn":
      return "yellow";
    case "info":
      return "blue";
    case "debug":
      return "gray";
    default:
      return "white";
  }
};

export default function RecentEvents({ appEvents }: { appEvents: AppEvent[] }) {
  return (
    <Box flexDirection="column">
      <Text bold underline>
        Recent Events:
      </Text>
      {appEvents.length === 0 && <Text dimColor>No events yet</Text>}
      {appEvents.map((e: AppEvent, idx: number) => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        return (
          <Box key={idx} gap={1}>
            <Text dimColor>{time}</Text>
            <Text color={getLevelColor(e.type)} bold>
              [{e.type.toUpperCase()}]
            </Text>
            <Text>{e.message}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
