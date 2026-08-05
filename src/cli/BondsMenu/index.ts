import { registerTerminalApplication } from "../utils/program_loader.ts";
import { Menu, MenuOption, TerminalUserStateConfig, TerminalUserStateConfigContext, CommandResultType } from "src/cli/types.ts";
import { menuGlobals } from "../utils/menu_globals.ts";
import { yieldsHandler } from "./actions/yields.ts";
import { Effect } from "effect";
import { BondsServiceLive } from "./services/index.ts";

const bondsMenuOptions = (state: TerminalUserStateConfig): MenuOption[] => [
  {
    name: "yields",
    command: "yields <code> [range]",
    description: "Fetch bond yield chart. Codes: US2, US5, US10, US30. Range: 1mo-10y (default 1y)",
    action: (bondCode: string, range?: string) =>
      yieldsHandler(bondCode, range).pipe(Effect.provide(BondsServiceLive)),
  },
  ...menuGlobals(state),
];

const bondsMenu: Menu = {
  name: "Bonds Menu",
  description: "Bonds Menu",
  messagePrompt: "Select an option:",
  options: bondsMenuOptions,
};

export const bondsTerminal = registerTerminalApplication(bondsMenu);
export default bondsTerminal;
