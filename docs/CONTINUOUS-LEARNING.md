# Continuous learning and compact fixture workflows

## Daily training

The GitHub `Daily model retraining` workflow runs at03:00UTC /04:00Africa/Lagos and supports manual dispatch. It collects retained, actually finished games from Convex, downloads an administrator-only compressed corpus, fits fixed-parameter models, evaluates candidates, and publishes evidence back to the registry. It calls no sports or odds provider. The existing API budgets remain unchanged. A workflow failure records failure status and leaves serving models untouched.

Historical bootstrap uses the already licensed provider exports via `training/seed_continuous.py` and `scripts/continuous-training.mjs seed`. The normalized seed contains39137 full/period results before retention/deduplication. Its result-availability timestamps are explicitly reconstructed as kickoff+48hours; they are not claimed to be original historical receipt times. New live results retain their earliest observed receipt time. Corrections reset availability, older seed versions cannot overwrite a newer corrected score, and cross-provider duplicates collapse by sport/competition/scope/team pair/kickoff minute. Known-source reschedules replace the old identity; distinct kickoff times preserve doubleheaders. The corpus retains up to4000 latest results per sport/league/scope. Current competition IDs or known mapped teams prevent league-name homonyms from contaminating the model.

Candidates train strictly before the evaluation cutoff with a48hour result gap. The test reserves the latest30% of results newer than the incumbent cutoff, with at least40 fixtures. Without new results, a refit can complete but must not be reported as an improvement on unseen data. Models must have at least20 new training results and40 mapped, unseen evaluation fixtures, more than1% lower categorical market Brier score, no log-loss deterioration and score MAE within2% of the incumbent. Both models are scored on the same fixture and market lines. Full totals, team totals and handicaps are evaluated for each supported sport/period scope. These are score-model gates, not proof of profitable executable odds or validation of every bookmaker settlement rule.

Qualified candidates are refitted to all available retained data for subsequent forecasts. The backend repeats the promotion checks, confirms the incumbent version has not changed, and never automatically replaces a validated serving model. All automatic updates remain unapproved with no approved betting markets or automatic stake recommendation. The next normal ingest reads the new serving artifact. Training cannot guarantee a higher future strike rate or profitability.

The model registry shows retained row count, latest completed run, status and segment evaluation evidence. Daily scheduling depends on GitHub Actions and its production environment secret; source coverage and available new completed games determine whether a segment can improve. No extra paid data acquisition is implicit.

## Compact UI and saved rules

Every accordion starts closed. Market groups sort choices by descending displayed model probability. Compact tiles show selection, model percentage, projection grade and available quote/fair estimate; analysis, refund/EV details and provenance remain in their own collapsed section. Only actual quoted pre-match selections can enter the slip.

Every eligible bet-machine shortlist option supports add/remove. Before addition, its current quote and fixture status are checked again. Saved ticket rules are subscriber-owned Convex records, capped at30 per account. Saving an existing name updates that set; loading it regenerates against current fixtures and prices. Relative windows move with the current time; custom dates remain fixed. Reusing rules does not reuse old match selections or imply a profitable ticket.

The mobile admin header uses independent copy/actions rows, and mobile admin navigation wraps in a two-column grid. Shared Instrument Sans typography, fresh brand-mark asset paths, compact dismissible internal product spotlights and credited stadium/arena photography harmonize the app. Spotlights are product navigation, not paid sponsorship or bookmaker endorsements. Images are locally served WebP assets with linked photographer credits in the landing page.

Photography: Christian Rebero Twahirwa, Kigali Arena, https://unsplash.com/photos/beige-and-blue-basketball-court-ggtFONGaWTo; Willian Justen de Vasconcellos, Beira Rio stadium, https://unsplash.com/photos/aerial-view-photography-of-soccer-stadium-K4IVAFtu9GA. Source pages identify these as free under the Unsplash License. No generated photo is presented as real sports coverage.

## Verification boundaries

Local isolated browser scenarios verify admin widths320/360/390/430/768/1440,109px compact tiles, closed accordions, descending choices, shortlist add/remove, saved-rule reuse and390px machine containment. Backend tests cover rule ownership/entitlement and candidate rejection/promotion without betting approval. Corpus tests cover identity, doubleheaders, correction availability and league isolation. Python tests cover insufficient data and chronological availability. These are distinct from a physical phone or real authenticated production session.
