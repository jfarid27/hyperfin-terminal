/**
 * Sports submenu (Polymarket).
 *
 * Entering `sports` from the polymarket menu lands here. Each sport is a
 * command that resolves the league from `/sports` and lists its current open
 * games.
 */

import { registerTerminalApplication } from "../../../utils/program_loader.ts";
import { type Menu } from "../../../types.ts";
import { sportsMenuOptions } from "./menu.ts";

const sportsMenu: Menu = {
  name: "Sports Menu",
  description: "Polymarket sports markets",
  messagePrompt: "Select a sport:",
  options: sportsMenuOptions,
};

export const sportsTerminal = registerTerminalApplication(sportsMenu);

export default sportsTerminal;
