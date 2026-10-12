import { writable } from "svelte/store";

export interface BetslipItem {
  fixtureId: string;
  sport: "football" | "basketball";
  matchTitle: string;
  market: string;
  selection: string;
  bookmaker: string;
  odds: number;
  edgePercent: number;
}

export const activeSport = writable<"all" | "football" | "basketball">("all");
export const betslipItems = writable<BetslipItem[]>([]);
export const betslipOpen = writable<boolean>(false);
export const userStake = writable<number>(1000); // ₦1,000 or $1,000 default

// Modal states
export const activeAiFixture = writable<{ fixtureId: string; sport: string; matchTitle: string } | null>(null);
export const activeScoreMatrix = writable<any | null>(null);
export const activePaceSimulation = writable<any | null>(null);

// Theme state
export const isDarkMode = writable<boolean>(true);
