import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { nflOption, sportsMenuOptions, tagsOption } from "./menu.ts";

describe("Polymarket Sports submenu options", () => {
  const options = sportsMenuOptions({} as never);
  const names = options.map((o) => o.name);

  it("exposes an nfl command with an optional limit", () => {
    expect(nflOption.name).toBe("nfl");
    expect(nflOption.command).toBe("nfl [limit]");
    expect(names).toContain("nfl");
  });

  it("exposes a tags command with an optional term", () => {
    expect(tagsOption.name).toBe("tags");
    expect(tagsOption.command).toBe("tags [term]");
    expect(names).toContain("tags");
  });
});
