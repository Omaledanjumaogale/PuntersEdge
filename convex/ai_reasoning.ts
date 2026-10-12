import { query } from "./_generated/server";
import { v } from "convex/values";

export const getMatchReasoning = query({
  args: { fixtureId: v.string(), sport: v.string() },
  handler: async (ctx, args) => {
    // If football
    if (args.sport === "football") {
      const match = await ctx.db
        .query("football_matches")
        .withIndex("by_fixture", (q) => q.eq("fixtureId", args.fixtureId))
        .first();

      if (!match) return null;

      return {
        fixtureId: args.fixtureId,
        matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
        summary: `Quantitative analysis indicates clear positive value on ${match.bestValue.selection} at ${match.bestValue.bestOdds} with ${match.bestValue.bookmaker}.`,
        marketAnalysis: `SportyBet is pricing this option at ${match.odds.sportybet.home}, whereas 1xBet offers ${match.bestValue.bestOdds}. Removing the 3.8% bookmaker margin gives fair odds of ${match.bestValue.fairOdds}.`,
        lineupAnalysis: match.lineupAlert,
        quantRecommendation: `Recommended stake is ${match.bestValue.kellyStakePercent}% of bankroll using Quarter-Kelly capital preservation. The most likely scoreline is ${match.topScorelines[0].home}-${match.topScorelines[0].away} with ${(match.topScorelines[0].prob * 100).toFixed(1)}% statistical probability.`,
      };
    }

    // If basketball
    const fixture = await ctx.db
      .query("basketball_fixtures")
      .withIndex("by_fixture", (q) => q.eq("fixtureId", args.fixtureId))
      .first();

    if (!fixture) return null;

    return {
      fixtureId: args.fixtureId,
      matchTitle: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      summary: `Pace model projects ${fixture.paceMetrics.possessionsPer48} possessions with an offensive rating of ${fixture.paceMetrics.homeOffRating} for ${fixture.homeTeam}.`,
      marketAnalysis: `Bookmaker point total is set around ${fixture.odds.sportybet.totalLine}, but Monte Carlo simulation projects ${fixture.projectedScore.total.toFixed(1)} total points.`,
      lineupAnalysis: fixture.lineupAlert,
      quantRecommendation: `Highest value option is ${fixture.bestValue.selection} offering an expected edge of +${fixture.bestValue.edgePercent}%. Recommended stake is ${fixture.bestValue.kellyStakePercent}% of bankroll.`,
    };
  },
});
