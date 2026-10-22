/**
 * Menu-tree invariants.
 *
 * Every menu, submenu and command is covered here, so a new submenu cannot ship
 * unreachable, a new menu-entry command cannot ship unlinked (which would make
 * the shell wedge on a raw-mode stdin read — see the plan's B1), and every
 * navigation option is proven to move the shell to a new state.
 *
 * Package menus are not in this static tree: they are discovered at startup from
 * `hyperfin-packages/`. `packages/menu_test.ts` covers their link.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Command } from "commander";
import type { Menu, TerminalUserStateConfig } from "./types.ts";
import { DataSourceType, EnvironmentType, LogLevel } from "./types.ts";
import { createMenuSession } from "./termui/session.ts";
import { mainMenu } from "./index.ts";
import { cryptoMenu } from "./CryptoMenu/index.ts";
import { technicalsMenu as cryptoTechnicalsMenu } from "./CryptoMenu/TechnicalsMenu/index.ts";
import { dexMenu } from "./CryptoMenu/DexMenu/index.ts";
import { ethereumMenu } from "./CryptoMenu/DexMenu/EthereumMenu/index.ts";
import { technicalsMenu as ethereumTechnicalsMenu } from "./CryptoMenu/DexMenu/EthereumMenu/TechnicalsMenu/index.ts";
import { stocksMenu } from "./StocksMenu/index.ts";
import { technicalsMenu as stocksTechnicalsMenu } from "./StocksMenu/TechnicalsMenu/index.ts";
import { governmentMenu } from "./GovernmentMenu/index.ts";
import { optionsMenu } from "./OptionsMenu/index.ts";
import { forexMenu } from "./ForexMenu/index.ts";
import { forexTechnicalsMenu } from "./ForexMenu/TechnicalsMenu/index.ts";
import { bondsMenu } from "./BondsMenu/index.ts";
import { newsMenu } from "./NewsMenu/index.ts";
import { redditMenu } from "./NewsMenu/RedditMenu/index.ts";
import { predictionMarketsMenu } from "./PredictionMarketMenu/index.ts";
import { polymarketMenu } from "./PredictionMarketMenu/PolymarketMenu/index.ts";
import { sportsMenu } from "./PredictionMarketMenu/PolymarketMenu/SportsMenu/index.ts";
import { kalshiMenu } from "./PredictionMarketMenu/KalshiMenu/index.ts";

const state: TerminalUserStateConfig = {
  environment: EnvironmentType.Development,
  logLevel: LogLevel.None,
  sessionPath: "sessions/menu_tree_test.jsonl",
  apiKeys: {
    coingecko: undefined,
    alphavantage: undefined,
    blockchaincom: undefined,
    freecryptoapi: undefined,
    fred: undefined,
    massive: undefined,
    yahoofinance: undefined,
    alpaca: undefined,
    coinmarketcap: undefined,
  },
  loadedContext: {
    stocks: { datasource: DataSourceType.AlphaVantage },
    options: { datasource: DataSourceType.YahooFinance },
    bonds: { datasource: DataSourceType.YahooFinance },
    forex: { datasource: DataSourceType.AlphaVantage },
  },
  scriptContext: {},
};

const allMenus: Menu[] = [
  mainMenu,
  cryptoMenu,
  cryptoTechnicalsMenu,
  dexMenu,
  ethereumMenu,
  ethereumTechnicalsMenu,
  stocksMenu,
  stocksTechnicalsMenu,
  governmentMenu,
  optionsMenu,
  forexMenu,
  forexTechnicalsMenu,
  bondsMenu,
  newsMenu,
  redditMenu,
  predictionMarketsMenu,
  polymarketMenu,
  sportsMenu,
  kalshiMenu,
];

/** A menu's path segment, the way the shell's breadcrumbs derive it. */
const segment = (menu: Menu): string => {
  const trimmed = menu.name.replace(/\s*menu\s*$/i, "").trim();
  return (trimmed || menu.name).toLowerCase();
};

const bySegment = new Map(allMenus.map((menu) => [segment(menu), menu]));

const commandToken = (command: string): string => command.split(/\s+/)[0];

describe("menu tree", () => {
  it("reaches every menu by following submenu links from the main menu", () => {
    const seen = new Set<Menu>();
    const walk = (menu: Menu) => {
      if (seen.has(menu)) return;
      seen.add(menu);
      for (const option of menu.options(state)) {
        const target = option.submenu?.();
        if (target) walk(target);
      }
    };
    walk(mainMenu);

    // An unreachable menu is dead code the user can never open.
    expect(allMenus.filter((menu) => !seen.has(menu)).map((menu) => menu.name))
      .toEqual([]);
  });

  it("links every option that would enter another menu", () => {
    const unlinked: string[] = [];
    for (const menu of allMenus) {
      for (const option of menu.options(state)) {
        const target = bySegment.get(commandToken(option.command));
        if (target && target !== menu && !option.submenu) {
          unlinked.push(`${segment(menu)}: ${option.command}`);
        }
      }
    }
    // Unlinked, the shell would dispatch the option's action, which starts a
    // nested menu loop that reads stdin in raw mode and wedges the app.
    expect(unlinked).toEqual([]);
  });

  it("declares every command in a form commander can register", () => {
    for (const menu of allMenus) {
      const program = new Command();
      program.exitOverride();
      for (const option of menu.options(state)) {
        expect(() => program.command(option.command)).not.toThrow();
      }
    }
  });

  it("moves the shell to a new state for every navigation option", () => {
    for (const menu of allMenus) {
      for (const option of menu.options(state)) {
        const target = option.submenu?.();
        if (!target) continue;

        const session = createMenuSession(menu, state);
        const submission = session.classify(option.command);

        expect(submission.kind).toBe("navigate");
        expect(submission.target).toBe(target);

        session.enter(target);
        expect(session.depth()).toBe(2);
        expect(session.current()).toBe(target);
      }
    }
  });

  it("gives every menu the globals that leave it", () => {
    for (const menu of allMenus) {
      const commands = menu.options(state).map((option) => commandToken(option.command));
      // The root is the only menu without `back`.
      if (menu !== mainMenu) expect(commands).toContain("back");
      expect(commands).toContain("exit");
    }
  });

  it("keeps path segments distinct enough to read a breadcrumb", () => {
    // Two menus may share a name (the two Technicals menus); they must still
    // both be reachable and resolve to themselves through their parents.
    expect(segment(cryptoMenu)).toBe("crypto");
    expect(segment(stocksMenu)).toBe("stocks");
    expect(segment(redditMenu)).toBe("reddit");
    expect(segment(kalshiMenu)).toBe("kalshi");
  });
});
