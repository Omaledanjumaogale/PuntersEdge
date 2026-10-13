/**
 * Plain-language glossary. Thresholds and methods quoted here mirror the
 * engine (decision_screener.gradeSelection, prediction_pipeline, Settings),
 * so the explanations stay true to what the app actually does.
 */

export type GlossaryCategory = 'Basics' | 'Grades' | 'Odds & value' | 'Markets' | 'Models' | 'Staking';

export interface GlossaryTerm {
	id: string;
	term: string;
	emoji: string;
	category: GlossaryCategory;
	short: string;
	long: string;
	example?: string;
}

export const CATEGORIES: { name: GlossaryCategory; emoji: string }[] = [
	{ name: 'Basics', emoji: '🧭' },
	{ name: 'Grades', emoji: '🏅' },
	{ name: 'Odds & value', emoji: '💡' },
	{ name: 'Markets', emoji: '🎯' },
	{ name: 'Models', emoji: '🧮' },
	{ name: 'Staking', emoji: '💰' }
];

export const GRADES = [
	{ grade: 'A+', emoji: '🔥', name: 'Strong value', rule: 'Decision score of 70 or more', tone: 'bg-model text-ink' },
	{ grade: 'A', emoji: '⚡', name: 'Good value', rule: 'Decision score from 60 to 70', tone: 'bg-model text-ink' },
	{ grade: 'B', emoji: '👍', name: 'Some value', rule: 'Decision score from 50 to 60', tone: 'tint-model text-model ring-1 ring-model/50' },
	{ grade: 'C', emoji: '🤏', name: 'Thin value', rule: 'Eligible quoted value below score 50', tone: 'bg-raised text-chalk ring-1 ring-line' },
	{ grade: 'PASS', emoji: '✋', name: 'Pass', rule: 'Fails price or probability checks', tone: 'bg-raised text-haze ring-1 ring-line' }
] as const;

export const GLOSSARY: GlossaryTerm[] = [
	// Basics
	{
		id: 'odds',
		term: 'Odds (decimal)',
		emoji: '🔢',
		category: 'Basics',
		short: 'What a winning ₦1 stake pays back, stake included.',
		long: 'Decimal odds of 2.04 mean a ₦1,000 bet returns ₦2,040 if it wins (₦1,040 profit). Lower odds mean the bookmaker thinks it is more likely.',
		example: '₦1,000 at 2.04 → ₦2,040 back.'
	},
	{
		id: 'implied-probability',
		term: 'Implied probability',
		emoji: '📐',
		category: 'Basics',
		short: 'The win chance a price suggests: 1 ÷ odds.',
		long: 'Odds of 2.00 imply 50%; 1.50 implies 66.7%. Bookmakers add a margin, so a market’s implied chances add up to more than 100%.',
		example: '1 ÷ 2.04 = 49%.'
	},
	{
		id: 'break-even',
		term: 'Break-even',
		emoji: '⚖️',
		category: 'Basics',
		short: 'How often a bet must win to not lose money long term.',
		long: 'Break-even is the implied probability of the price you take. The amber “Needs” marker in “Why this pick?” shows it. If our estimate sits above it, the bet has value.',
		example: 'At 2.04 you need to win 49% of the time.'
	},
	{
		id: 'pick',
		term: 'Pick / selection',
		emoji: '📌',
		category: 'Basics',
		short: 'One outcome you can bet on, like “Arsenal win” or “Over 2.5 goals”.',
		long: 'Each fixture has dozens of selections across its markets. The ticket on each card is the selection with the biggest edge; tap 🎯 Markets to see the rest.'
	},
	// Grades
	{
		id: 'grades',
		term: 'Grades: A+, A, B, C, PASS',
		emoji: '🏅',
		category: 'Grades',
		short: 'How strong the value is, from 🔥 A+ down to ✋ PASS.',
		long: 'Grades use the shared decision score: estimated outright win likelihood has 65% weight, bounded positive expected value 25%, and probability cushion above break-even 10%, discounted for model disagreement. Eligible quoted selections receive A+ at score 70, A at 60, B at 50 and C below 50. Derived prices, nonpositive EV, estimated win likelihood below 50%, unusually high EV or excessive model-market disagreement retain PASS. This is a ranking policy, not a proven success percentage; performance is measured from published predictions and final results.',
		example: 'A positive edge on a longshot may still receive PASS. A high grade does not guarantee a win.'
	},
	{
		id: 'pass',
		term: 'PASS / no bet',
		emoji: '✋',
		category: 'Grades',
		short: 'Price or probability checks do not support a recommendation.',
		long: 'Passing is a decision, not a failure. The bookmaker’s margin means most bets lose money over time; you only want the ones where the price is better than the true chance.'
	},
	{
		id: 'confidence',
		term: 'Confidence meter',
		emoji: '🟣',
		category: 'Grades',
		short: 'How strongly our four checks agree, out of five dots.',
		long: 'Market, squad, model and risk checks each give a confidence; the dots show their average. It is a sanity check on the edge, not a promise the bet wins.'
	},
	// Odds & value
	{
		id: 'edge',
		term: 'Edge',
		emoji: '📈',
		category: 'Odds & value',
		short: 'Expected profit per ₦100 staked, over the long run.',
		long: 'Edge = our probability × odds − 1. A +10% edge means that, if you made this bet many times, you would expect ₦10 profit per ₦100 staked on average. Any single bet still wins or loses.',
		example: '54% × 2.04 − 1 = +10.2%.'
	},
	{
		id: 'value-bet',
		term: 'Value bet',
		emoji: '🔥',
		category: 'Odds & value',
		short: 'A bet whose odds are higher than the fair odds.',
		long: 'Value does not mean likely to win. A 30% shot at odds of 4.00 is value (it only needs 25%); a 90% favourite at 1.05 is not (it needs 95%).'
	},
	{
		id: 'fair-odds',
		term: 'Fair odds',
		emoji: '🟢',
		category: 'Odds & value',
		short: 'The price with no bookmaker margin: 1 ÷ our probability.',
		long: 'Shown in teal next to the bookmaker’s price in amber. If the amber price is higher than the teal one, the bet has value.',
		example: '54% → fair odds 1.85.'
	},
	{
		id: 'margin',
		term: 'Margin (vig, overround)',
		emoji: '🏦',
		category: 'Odds & value',
		short: 'The bookmaker’s built-in cut.',
		long: 'Add up 1 ÷ odds for every outcome of a market; the amount over 100% is the margin. Lower is better for you. The Bookmakers page compares them.',
		example: '1/1.95 + 1/3.65 + 1/3.90 = 104.3% → 4.3% margin.'
	},
	{
		id: 'devig',
		term: 'De-vig (Shin method)',
		emoji: '🧽',
		category: 'Odds & value',
		short: 'Removing the margin to see the market’s honest view.',
		long: 'We strip each bookmaker’s margin with Shin’s method, which takes more off long shots than favourites (books overprice long shots). Averaging across books gives the market consensus.'
	},
	{
		id: 'market-probability',
		term: 'Market probability',
		emoji: '👥',
		category: 'Odds & value',
		short: 'What the bookmakers collectively think, after removing margin.',
		long: 'Shown as the dashed tick in “Why this pick?”. Our estimate blends this with the model; you choose the mix in Settings.'
	},
	{
		id: 'price-moving',
		term: 'Price moving / steam',
		emoji: '📉',
		category: 'Odds & value',
		short: 'Odds have shortened sharply since they opened.',
		long: 'When a price drops while most tickets are on the other side, it usually means large, informed bets came in. We flag it but never treat it as proof.'
	},
	{
		id: 'derived-price',
		term: 'Derived price',
		emoji: '🧩',
		category: 'Odds & value',
		short: 'A price built from the bookmaker’s own headline odds.',
		long: 'Our feed has bookmakers’ headline markets. Their other markets (double chance, handicaps, alternative lines) are derived from those prices and that book’s margin, the way bookmakers set them. Always confirm the price at the bookmaker.'
	},
	// Markets
	{ id: '1x2', term: '1X2 / match result', emoji: '🏆', category: 'Markets', short: 'Home win (1), draw (X) or away win (2) after 90 minutes.', long: 'The most popular football market. Extra time and penalties do not count.' },
	{ id: 'double-chance', term: 'Double chance', emoji: '🛡️', category: 'Markets', short: 'Two of the three results: 1X, 12 or X2.', long: 'Wins more often than a straight win bet but pays less. 1X wins if the home team wins or draws.' },
	{ id: 'dnb', term: 'Draw no bet', emoji: '🤝', category: 'Markets', short: 'Back a team; get your stake back if it’s a draw.', long: 'Like a win bet with draw insurance. Our edge figures account for the refund.' },
	{
		id: 'asian-handicap',
		term: 'Asian handicap',
		emoji: '⚖️',
		category: 'Markets',
		short: 'A goal head start or deficit, so there’s no draw.',
		long: 'Arsenal −1.5 needs to win by 2+. Chelsea +1.5 wins unless they lose by 2+. On whole lines (−1, +1) a result that lands exactly on the line refunds your stake.',
		example: 'Arsenal −1: win by 2 = win, by 1 = refund, otherwise lose.'
	},
	{ id: 'over-under', term: 'Over / under', emoji: '⚽', category: 'Markets', short: 'Total goals or points above or below a line.', long: 'Over 2.5 goals needs 3 or more. Half-point lines mean there is never a tie.' },
	{ id: 'btts', term: 'BTTS (both teams to score)', emoji: '🎯', category: 'Markets', short: 'Does each team score at least once?', long: 'BTTS Yes wins with 1–1, 2–1, 3–2 and so on; any clean sheet makes it lose.' },
	{ id: 'team-goals', term: 'Team goals', emoji: '🥅', category: 'Markets', short: 'One team’s goals over a line.', long: 'Arsenal over 1.5 wins if Arsenal score twice, whatever Chelsea do.' },
	{ id: 'clean-sheet', term: 'Clean sheet', emoji: '🧤', category: 'Markets', short: 'A team concedes no goals.', long: 'Arsenal clean sheet wins with 0–0, 1–0, 2–0 and so on.' },
	{ id: 'moneyline', term: 'Moneyline', emoji: '💵', category: 'Markets', short: 'Who wins, overtime or extra innings included.', long: 'Used in basketball, hockey and baseball: no draw option, the moneyline is simply who wins once any overtime, shootout or extra innings are played.' },
	{
		id: 'spread',
		term: 'Point spread',
		emoji: '📏',
		category: 'Markets',
		short: 'Basketball’s handicap: win by more than the line.',
		long: 'Celtics −8.5 must win by 9+. Heat +8.5 wins if they win or lose by 8 or fewer.'
	},
	{
		id: 'accumulator',
		term: 'Accumulator (acca)',
		emoji: '🧾',
		category: 'Markets',
		short: 'Several picks combined; all must win.',
		long: 'Odds multiply, but so does the bookmaker’s margin. Picks from the same match are linked, so combining them is risky and often not allowed.'
	},
	// Models
	{ id: 'puck-line', term: 'Puck line', emoji: '🏒', category: 'Markets', short: 'Hockey handicap: one team gets −1.5 goals, the other +1.5.', long: 'The favourite at −1.5 must win by two or more; the underdog at +1.5 wins the bet if they win or lose by one. Overtime and shootout goals count. We price both sides from the same goal model as the moneyline.', example: 'Oilers −1.5 at 2.50 needs a two-goal Oilers win.' },
	{ id: 'run-line', term: 'Run line', emoji: '⚾', category: 'Markets', short: "Baseball's ±1.5 handicap.", long: 'Like the puck line: −1.5 needs a win by two or more runs, +1.5 covers any win or a one-run loss. Extra innings count.', example: 'Dodgers −1.5 at 2.25 pays if the Dodgers win 5–3.' },
	{ id: 'regulation', term: 'Regulation time', emoji: '⏱️', category: 'Markets', short: 'Hockey: the first 60 minutes, before overtime.', long: 'Regulation (1X2) hockey bets settle after 60 minutes, so a tie is a draw. Moneyline, puck line and totals include overtime and the shootout, where the winner is credited one extra goal.', example: 'A 2–2 game won in a shootout: regulation draw wins, home moneyline wins, total settles on 5.' },
	{ id: 'extra-play', term: 'Overtime / extra innings', emoji: '➕', category: 'Markets', short: 'How hockey, baseball and basketball break ties.', long: 'Our engines resolve a tied regular game the way the books settle it: the side that wins extra play is credited one more goal or run. That keeps moneyline, handicap and total prices consistent with each other.' },
	{ id: 'team-total', term: 'Team total (goals / runs)', emoji: '🧢', category: 'Markets', short: 'Over or under for one team only.', long: 'Priced from that team\'s own scoring distribution, including extra play. Books often derive these from their headline prices; we do the same per book and label them "derived".' },
	{ id: 'model-probability', term: 'Model probability', emoji: '🧮', category: 'Models', short: 'Our estimate of how often an outcome happens.', long: 'A blend of our model and the market consensus (60/40 by default, adjustable in Settings). Shown in teal.' },
	{ id: 'xg', term: 'xG (expected goals)', emoji: '🥾', category: 'Models', short: 'How many goals a team is expected to score in this match.', long: 'Built from team strength and adjusted for missing players. xG 1.92 vs 1.02 means the home side is expected to score almost twice as many.' },
	{ id: 'dixon-coles', term: 'Dixon–Coles model', emoji: '📊', category: 'Models', short: 'The football model behind every score probability.', long: 'Turns expected goals into the chance of every exact score, with a correction for low scores (0–0, 1–0, 0–1, 1–1). Every football market is read off that score grid.' },
	{ id: 'score-surface', term: '3D score surface', emoji: '🗻', category: 'Models', short: 'The towers chart: one tower per exact score.', long: 'Taller towers are likelier scores. Rows are home goals, columns away goals.' },
	{ id: 'pace', term: 'Pace / possessions', emoji: '🏀', category: 'Models', short: 'How many times each team has the ball in a game.', long: 'Faster games mean more possessions and more points. Our basketball model multiplies pace by each team’s scoring per possession, adjusted for the opponent’s defence.' },
	{ id: 'poisson-hockey', term: 'Poisson goal model (hockey)', emoji: '🏒', category: 'Models', short: 'Goals arrive at a steady rate, so each team\'s count follows a Poisson curve.', long: 'From each team\'s expected regulation goals we build a grid of every scoreline, add overtime/shootout for ties, and read moneyline, puck line, totals and team totals off it. Expected goals come from the league table (shrunk toward average early in the season) or, without a table, from the market.' },
	{ id: 'negbin', term: 'Negative binomial (baseball)', emoji: '⚾', category: 'Models', short: 'Runs come in bunches, so blowouts are more common than a Poisson curve predicts.', long: 'We model each team\'s runs with a negative binomial: same average, fatter tail. That matters for overs, run lines and team totals.' },
	{ id: 'shrinkage', term: 'Shrinkage', emoji: '🧲', category: 'Models', short: 'Pulling small-sample numbers toward the league average.', long: 'After three games a team that scored eight looks unstoppable. We add a few games of league-average performance to every team before rating it, so early-season numbers don\'t run wild. The effect fades as the season goes on.' },
	{ id: 'track-record', term: 'Track record', emoji: '📈', category: 'Models', short: 'How our graded picks actually did.', long: 'Shortly before each game we record its best A+, A or B pick at the best quoted price, then settle it from the final score. Profit is in units (1 unit staked per pick). It\'s the honest test of the engine; short runs are noisy.' },
	{ id: 'live-feed', term: 'Live feed & quotas', emoji: '📡', category: 'Basics', short: 'Where fixtures, scores and prices come from.', long: 'A backend refreshes every 30 minutes from licensed APIs (API-Sports for fixtures, scores and tables; The Odds API and OddsPapi for bookmaker prices). Each provider has a request quota, so calls are budgeted: only what\'s due and relevant, spread evenly over the day and month.' },
	{ id: 'injury-adjustment', term: 'Absences', emoji: '🚑', category: 'Models', short: 'Missing players, priced into the numbers.', long: 'Each absence weakens attack and defence according to the player’s role and minutes. The card shows how many are out.' },
	// Staking
	{ id: 'bankroll', term: 'Bankroll', emoji: '💰', category: 'Staking', short: 'Money set aside only for betting.', long: 'Every stake is a share of it. Set yours in Settings. Never bet money you need for anything else.' },
	{
		id: 'kelly',
		term: 'Kelly stake',
		emoji: '📏',
		category: 'Staking',
		short: 'The stake size that grows a bankroll fastest for a given edge.',
		long: 'Full Kelly is too aggressive if the model is ever wrong, so we use a fraction (¼ by default) and cap any single bet at 3.5% of your bankroll.',
		example: '₦50,000 bankroll, 2.4% stake → ₦1,200.'
	},
	{ id: 'expected-profit', term: 'Expected profit', emoji: '🧮', category: 'Staking', short: 'Average result if you placed the same slip many times.', long: 'Shown in the slip. It can be positive while most single slips still lose, especially accumulators.' },
	{ id: 'responsible', term: 'Betting responsibly', emoji: '🧠', category: 'Staking', short: '18+ only. Stakes you can afford to lose.', long: 'Set a bankroll and stick to it, never chase losses, and take breaks. Positive expected value is a long-run idea; short runs of losses are normal.' }
];
