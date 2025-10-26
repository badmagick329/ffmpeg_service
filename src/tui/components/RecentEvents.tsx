import type { AppEvent } from "@/tui/lib/app-state";
import { Box, Text } from "ink";
import { ScrollableList, useListItemWidth } from "ink-scrollable-list";

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

const BRACKET_AND_SPACE_LENGTH = 5;
const ELLIPSIS_LENGTH = 3;

export default function RecentEvents({ appEvents }: { appEvents: AppEvent[] }) {
  const safeWidth = useListItemWidth(true, "round");

  return (
    <Box flexDirection="column">
      <Text bold underline>
        Recent Events:
      </Text>
      {appEvents.length === 0 ? (
        <Text dimColor>No events yet</Text>
      ) : (
        <ScrollableList
          key={appEvents.length}
          items={appEvents}
          visibleCount={5}
          startAtBottom={true}
          renderItem={(e) => {
            const time = new Date(e.timestamp).toLocaleTimeString();
            const messageSafeWidth = Math.max(
              ELLIPSIS_LENGTH,
              safeWidth -
                time.length -
                e.type.length -
                BRACKET_AND_SPACE_LENGTH -
                ELLIPSIS_LENGTH
            );

            let trimmedMessage = e.message.slice(-messageSafeWidth);
            if (e.message.length > messageSafeWidth) {
              trimmedMessage = "..." + trimmedMessage;
            }

            return (
              <Box gap={1}>
                <Text dimColor>{time}</Text>
                <Text color={getLevelColor(e.type)} bold>
                  [{e.type.toUpperCase()}]
                </Text>
                <Text>{trimmedMessage}</Text>
              </Box>
            );
          }}
        />
      )}
    </Box>
  );
}
