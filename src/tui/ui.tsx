import type { AppState } from "@/tui/lib/app-state";
import Main from "@/tui/components/Main";
import { render } from "ink";

export const start = (appState: AppState) =>
  render(<Main appState={appState} />);
