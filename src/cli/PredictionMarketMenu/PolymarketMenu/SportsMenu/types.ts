/**
 * @file Sports submenu types.
 * @description Types for the Polymarket sports submenu, mirroring the Gamma
 * `/sports` endpoint and the game events it resolves to.
 */

/**
 * A league entry from the Gamma `/sports` endpoint.
 *
 * `sport` is the short league key (e.g. `nfl`), `primaryTagId`/`tags` are the
 * tag ids that identify that league's markets, and `series` is the series id
 * that the league's game events hang off.
 */
export interface PolymarketSport {
  id: number;
  sport: string;
  name: string;
  primaryTagId: number;
  tags: string;
  series: string;
  ordering?: string;
  resolution?: string;
  image?: string;
}
