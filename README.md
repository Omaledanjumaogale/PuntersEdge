# QuantEdge | Autonomous Sports Prediction Engine & PWA

[![PWA Ready](https://img.shields.io/badge/PWA-Installable-success.svg)](#progressive-web-app)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen.svg)](#getting-started)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

**QuantEdge** is an enterprise-grade quantitative sports analytics platform and Progressive Web Application (PWA) designed specifically for **basketball fixtures** and **football scheduled matches**. 

It reverse-engineers and synthesizes real-time market telemetry from **Matchplay.com**, **RedScores.com**, **SportyBet**, **1xBet**, **22Bet**, and **24Live**, fusing mathematical scoring models with an autonomous **In-App AI LLM Multi-Agent reasoning hub**.

---

## ⚡ Core Capabilities

### 🏀 1. Basketball Tempo-Free Modeling (`sr:sport:2`)
* **Possession & Pace Factor**: Projects possessions per 48 minutes based on mutual tempo:
  $$\text{Pace}_{\text{expected}} = \frac{\text{Pace}_{\text{home}} \times \text{Pace}_{\text{away}}}{\text{Pace}_{\text{league}}}$$
* **Adjusted Efficiency Ratings**: Normalizes Offensive and Defensive Ratings adjusted for opponent defense and home-court advantage (+2.8 pts).
* **Monte Carlo Simulation (25,000 iterations)**: Full probability distribution of point totals (Over/Under lines), point spreads, and team total points.

### ⚽ 2. Football Scheduled Match Modeling (`sr:sport:1`)
* **Dixon-Coles Bivariate Poisson Core**: Solves expected goal parameters $(\lambda_{\text{home}}, \mu_{\text{away}})$ and produces exact $10 \times 10$ score probability matrices with low-score correlation adjustments ($\tau$ parameter for $0-0, 1-0, 0-1, 1-1$).
* **Derivative Market Probabilities**: Computes exact percentage probabilities for:
  * 1X2 (Home Win / Draw / Away Win)
  * Double Chance (1X, 12, X2)
  * Draw No Bet (DNB 1, DNB 2)
  * Over / Under Goals (1.5, 2.5, 3.5, 4.5)
  * Both Teams to Score (BTTS Yes / No)
* **RedScores Lineup Shock Matrix**: Quantifies player absences (injuries, suspensions) with minutes-weighted ratings, adjusting team attack and defense baselines before kickoff.

### 📊 3. Multi-Bookmaker Discrepancy & Odds Movement
* **Cross-Bookmaker Audits**: Real-time price comparison across **SportyBet**, **1xBet**, and **22Bet**.
* **Vig & Overround Normalization**: Strips bookmaker margins using Multiplicative and Power vig-removal models to reveal true fair probabilities.
* **Reverse Line Movement (RLM) & Steam Detector**: Identifies when smart institutional syndicate capital moves odds contrary to public retail volume.
* **SportyBet Accumulator (`oddsKeys`) Retention Audit**: Protects punters from compounding multi-leg edges.

### 🤖 4. In-App AI LLM Multi-Agent Reasoning Hub
Coordinates 4 specialized sub-agents to deliver conversational, high-conviction insights:
1. **Market Intelligence Agent**: Tracks line drift, bookmaker discrepancies, and steam moves.
2. **Squad & Tactical Agent**: Ingests confirmed lineups, minutes-weighted player absences, and fatigue.
3. **Quantitative Modeling Agent**: Executes Poisson, Dixon-Coles, and Monte Carlo models.
4. **Master Strategist Agent**: Synthesizes all inputs, identifies $+EV$ value bets, assigns Confidence Ratings ($A+$ to $C$), calculates Fractional Kelly stakes, and generates plain-English rationale.

---

## 📱 Progressive Web App (PWA) Features

* **Full Mobile & Desktop Install**: Compliant with W3C Web App Manifest standards.
* **Network-First Service Worker**: Reliable offline caching with stale-while-revalidate fallback.
* **High-Contrast Theme**: Optimized dark and light themes with enterprise accessibility standards.

---

## 📁 Repository Structure

```text
├── docs/
│   └── ARCHITECTURE.md          # Full architectural & mathematical blueprint
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Enterprise service worker
│   ├── register-sw.js           # Service worker registration & install banner
│   └── icons/                   # High-res PWA application icons
├── src/
│   ├── vig_removal.js           # Bookmaker margin & vig removal
│   ├── football_model.js        # Dixon-Coles & Poisson scoring engine
│   ├── basketball_model.js      # Tempo-free pace & Monte Carlo engine
│   ├── lineup_impact.js         # RedScores absence impact recalibration
│   ├── bookmaker_engine.js      # Multi-bookmaker audit & market options derivation
│   ├── data_fetcher.js          # Unified match & telemetry ingestion client
│   ├── decision_screener.js     # +EV screener & Fractional Kelly staking
│   ├── ai_agent_orchestrator.js # In-app AI LLM Multi-Agent Hub
│   └── index.js                 # Master orchestration pipeline
├── test/
│   └── engine.test.js           # Complete test suite (9 passing tests)
├── index.html                   # PWA entry page
├── package.json                 # Project configuration
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
* Node.js v22.x or later
* npm v11.x or later

### Installation
```bash
# Clone the repository
git clone https://github.com/Omaledanjumaogale/QuantEdge-Sports-PWA.git
cd QuantEdge-Sports-PWA

# Install dependencies (if applicable)
npm install
```

### Running the Quantitative Pipeline
```bash
node src/index.js
```

### Running Automated Unit Tests
```bash
npm test
```

---

## 📖 In-Depth Documentation

For full architectural diagrams, microservice boundaries, API contracts, and mathematical formulas, read:
👉 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

---

## ⚖️ License
MIT License. Copyright (c) 2026 QuantEdge Engineering.
