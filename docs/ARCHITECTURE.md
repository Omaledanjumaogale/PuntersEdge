# QuantEdge Enterprise Production Architecture (Master Specification)
## High-Frequency Multi-Bookmaker Ingestion, AI Multi-Agent Reasoning & Quantitative Prediction Engine

---

### 1. Executive Summary

**QuantEdge** is an enterprise-grade quantitative sports intelligence platform that fuses:
1. **Live Odds Velocity & Sharp Consensus (Matchplay & 24Live)**: Ingests tick-by-tick odds movement, closing line values (CLV), steam moves, and consensus sentiment.
2. **Bookmaker Engineering & Margin Loading (SportyBet, 1xBet & 22Bet)**: Dissects bookmaker liability balancing algorithms, multi-market derivations (Double Chance, Draw No Bet, Asian Handicap, Over/Under, BTTS), and accumulator compound margin decay.
3. **Tactical & Squad Injury Shocks (RedScores)**: Lineup confirmation webhooks, player minutes-weighted absence impacts, and situational form decay.
4. **Autonomous AI LLM Multi-Agent Hub**: Four coordinated in-app agents (Market Intelligence, Squad Context, Math Core, Lead Strategist) that synthesize statistical calculations into plain English rationales, confidence ratings ($A+$ to $C$), and risk-managed fractional Kelly stakes.

---

### 2. Reverse-Engineering the Bookmakers & Feeds

```mermaid
flowchart LR
    subgraph TargetBookies ["Target Bookmakers & Telemetry Feeds"]
        SB["SportyBet (NG/Global)<br/>• Sportradar MTS Integration<br/>• alive-ng.sportybet.com (WSS)<br/>• OddsKeys Accumulator Decay"]
        XB["1xBet / 22Bet (BetB2B)<br/>• 1,500+ Markets per Match<br/>• Dynamic Liability Pricing<br/>• 1.5% - 3.5% Tier 1 Margins"]
        LIVE["24Live<br/>• Real-time SSE / WebSockets<br/>• Match Timelines & In-Play Momentum"]
        MP["Matchplay & RedScores<br/>• sr:sport:1 & sr:sport:2 URNs<br/>• Squad Absences & Lineup Shocks"]
    end

    subgraph DataNormalization ["Unified Ingestion Engine"]
        ADAPTER["Protocol Adapters<br/>(WSS / SSE / REST Pollers)"]
        PARSER["Canonical Match Entity Parser<br/>(1X2, DC, DNB, O/U, BTTS, Lineups)"]
    end

    subgraph CorePlatform ["QuantEdge Enterprise Core"]
        ARB["Arb & +EV Engine<br/>• Cross-Bookmaker Surebet Detector<br/>• Vig Removal (Shin / Multiplicative)"]
        MATH["Simulation Core<br/>• Dixon-Coles Football (10x10 Matrix)<br/>• Tempo-Free Basketball Monte Carlo"]
        AGENTS["AI Multi-Agent Reasoning Hub<br/>• Market Agent<br/>• Tactical Agent<br/>• Quant Agent<br/>• Master Strategist"]
    end

    TargetBookies --> ADAPTER
    ADAPTER --> PARSER
    PARSER --> ARB
    PARSER --> MATH
    ARB --> AGENTS
    MATH --> AGENTS
```

#### A. SportyBet Architecture & Pricing Mechanics
* **Internal Protocols**:
  - Live Odds & Push Engine: WebSocket `wss://alive-ng.sportybet.com` streaming live price changes, market locks, and score events.
  - Data Provider: Sportradar Client ID (`638846b93b23ecfc94ce1a6d45b1dbe6`) running Sportradar MTS (Managed Trading Services).
* **Liability & Odds Balancing Algorithm**:
  - SportyBet sets baseline prices using Sportradar raw odds, then applies an asymmetric risk curve.
  - When retail punter volume heavily concentrates on one outcome (e.g. $> 70\%$ stakes on Arsenal), the automated risk engine drops the odds from $1.62 \to 1.50$ to discourage further liability, while boosting the draw and away options.
* **Accumulator / FlexiBet Margin Compounding (`oddsKeys`)**:
  - SportyBet's internal configuration revealed a mathematical retention curve (`oddsKeys: {3: 0.95, 4: 0.90, ..., 15: 0.65, ..., 50: 0.15}`).
  - While single bets carry a $3.0\% - 4.5\%$ margin, a 4-leg accumulator carries an **$18.5\%$ compound bookmaker edge**, increasing to **$45\%$+** on 10+ legs. QuantEdge advises punters on optimal leg thresholds and single +EV value.

#### B. 1xBet & 22Bet (BetB2B Platform)
* **Market Granularity**: Over 1,500 available markets per match.
* **Margin Structure**:
  - **Tier 1 (EPL, UCL, La Liga)**: Extremely competitive $1.5\% - 3.2\%$ overround.
  - **Tier 3 (Local leagues, NPFL)**: High vig of $7.5\% - 10.0\%$.
* **Discrepancy Capture**: Because 1xBet / 22Bet adjust prices via different market-making algorithms than SportyBet, systematic pricing lags occur between books during team news breaks (a 3–8 minute window where one bookmaker still offers 1.85 while competitors dropped to 1.70).

#### C. 24Live (`24live.com`)
* High-frequency live score, timeline events (shots, corners, dangerous attacks), and live odds fluctuation tracking.

---

### 3. In-App AI LLM Multi-Agent System Architecture

QuantEdge introduces an autonomous multi-agent hierarchy where distinct AI sub-agents debate match conditions before presenting the final verdict to the user:

```mermaid
sequenceDiagram
    participant User as Punter / User Interface
    participant Master as Master AI Strategist Agent
    participant Market as Agent 1: Market Intelligence
    participant Squad as Agent 2: Squad Context
    participant Math as Agent 3: Quantitative Core

    User->>Master: Request In-Depth Match Analysis & Prediction
    par Sub-Agent Analysis
        Master->>Market: Audit SportyBet vs 1xBet/22Bet drift & steam
        Market-->>Master: Report RLM, Sharp Volume & Margin Discrepancy
        Master->>Squad: Audit RedScores confirmed lineups & injuries
        Squad-->>Master: Report Missing Starters & Minutes-Weighted Shock
        Master->>Math: Execute Dixon-Coles & Poisson Simulations
        Math-->>Master: Output Exact Score Matrix, 1X2, DC, DNB, O/U, BTTS
    end
    Master->>Master: Synthesize Consensus, Screen +EV Edge & Calculate Kelly Stake
    Master->>User: Deliver Plain English Rationale, Probabilities & Confidence Tier (A+)
```

1. **Agent 1: Market Intelligence Agent**:
   - Detects Reverse Line Movement (RLM), steam moves, and closing line value (CLV).
   - Monitors multi-bookmaker discrepancies (SportyBet vs. 1xBet vs. 22Bet).
2. **Agent 2: Squad & Tactical Context Agent**:
   - Ingests RedScores confirmed lineups, missing key players, travel fatigue, and manager tactics.
   - Quantifies defense degradation and attack reduction deltas.
3. **Agent 3: Quantitative Modeling Core**:
   - Computes Dixon-Coles bivariate score matrices ($10 \times 10$) and Basketball tempo-free Monte Carlo distributions ($25,000$ iterations).
   - Derives all derivative markets: Double Chance (1X, 12, X2), Draw No Bet (DNB), Over/Under (1.5, 2.5, 3.5), Both Teams to Score (BTTS), and Exact Scores.
4. **Agent 4: Master AI Strategist (Lead Agent)**:
   - Evaluates $+EV = (P_{\text{model}} \times \text{Odds}) - 1 > \text{Threshold}$.
   - Computes Fractional Kelly Criterion stake (Quarter-Kelly) with safety caps.
   - Formulates plain-English, jargon-free explanations with confidence grades ($A+$ to $C$).

---

### 4. Mathematical Engine Invariants

#### A. Multi-Market Derivations from True Probability $P(1), P(X), P(2)$

$$\text{Double Chance (1X)}: P(1X) = P(1) + P(X), \quad \text{Fair Odds} = \frac{1}{P(1X)}$$
$$\text{Double Chance (12)}: P(12) = P(1) + P(2), \quad \text{Fair Odds} = \frac{1}{P(12)}$$
$$\text{Double Chance (X2)}: P(X2) = P(X) + P(2), \quad \text{Fair Odds} = \frac{1}{P(X2)}$$

$$\text{Draw No Bet (Home)}: P(\text{DNB}_1) = \frac{P(1)}{P(1) + P(2)}, \quad \text{Fair Odds} = \frac{1}{P(\text{DNB}_1)}$$

#### B. Cross-Bookmaker Arbitrage (Surebet) Detection
Across bookmakers $A, B, C$:
$$\text{Arbitrage Overround } \Omega = \frac{1}{\max(O_{\text{home}})} + \frac{1}{\max(O_{\text{draw}})} + \frac{1}{\max(O_{\text{away}})}$$
If $\Omega < 1.0$, a guaranteed risk-free arbitrage profit margin exists:
$$\text{Profit Margin} = \frac{1 - \Omega}{\Omega} \times 100\%$$

#### C. Fractional Kelly Staking
$$\text{Stake}^* = \min\left(\alpha \times \frac{b \cdot p - q}{b}, \text{Cap}_{\max}\right)$$
where $\alpha = 0.25$ (Quarter-Kelly), $b = \text{Odds} - 1$, $p = P_{\text{model}}$, $q = 1 - p$.

---

### 5. Verified Code Modules (In Workspace)

The production-ready modules are built and tested at [scratch/sports-predict-engine](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine):

| File | Purpose | Test Status |
| :--- | :--- | :--- |
| [src/vig_removal.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/vig_removal.js) | Multiplicative & Power Vig Removal | Pass |
| [src/football_model.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/football_model.js) | Dixon-Coles & Poisson 10x10 Scoring Matrix | Pass |
| [src/basketball_model.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/basketball_model.js) | Tempo-Free Pace & Monte Carlo Points | Pass |
| [src/lineup_impact.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/lineup_impact.js) | RedScores Lineup Absence Degradation Matrix | Pass |
| [src/decision_screener.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/decision_screener.js) | +EV, RLM, and Kelly Staking | Pass |
| [src/bookmaker_engine.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/bookmaker_engine.js) | SportyBet/1xBet/22Bet Comparison, Arbitrage, DC/DNB | Pass |
| [src/data_fetcher.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/data_fetcher.js) | Canonical Match & Telemetry Normalizer | Pass |
| [src/ai_agent_orchestrator.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/src/ai_agent_orchestrator.js) | Multi-Agent LLM Orchestrator & Synthesizer | Pass |
| [test/engine.test.js](file:///C:/Users/OMALE%20DANJUMA%20OGALE/.gemini/antigravity-ide/scratch/sports-predict-engine/test/engine.test.js) | 9 Unit Tests verifying all mathematical invariants | 9/9 Pass |
