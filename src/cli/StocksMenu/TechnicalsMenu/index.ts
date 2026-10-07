/**
 * Technicals submenu (stocks).
 *
 * Entering `technicals` from the stocks menu lands here, listing one option per
 * indicator. Each option keeps the chart-style parameter structure — an
 * optional leading symbol that falls back to the loaded token — plus the
 * indicator's own parameters, e.g. `bbands NVDA 20 2`.
 *
 * Unlike crypto, the data source is branched on inside the action — AlphaVantage
 * daily bars or Massive `/v2/aggs` bars, per `st.loadedContext.stocks.datasource`.
 */

import { registerTerminalApplication } from "../../utils/program_loader.ts";
import { type Menu } from "../../types.ts";
import { technicalsMenuOptions } from "./menu.ts";

const technicalsMenu: Menu = {
  name: "Technicals Menu",
  description: "Technical analysis indicators",
  messagePrompt: "Select an indicator:",
  options: technicalsMenuOptions,
};

export const technicalsTerminal = registerTerminalApplication(technicalsMenu);

export default technicalsTerminal;
