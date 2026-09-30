# Decision Lab

Decision Lab is a privacy-first decision-intelligence web app. It is designed to help people structure complex decisions, make assumptions explicit, explore uncertainty, learn their tradeoffs over time, and compare consequences without requiring a backend or API key.

## Decision capabilities

1. Uncertainty-aware scoring — low / likely / high estimates and Monte Carlo propagation.
2. Decision trees — probability-weighted branches, expected value, upside and downside.
3. Sequential decisions — multi-stage timeline modeling with time discounting.
4. Value of Information — estimates which unanswered question is most useful to resolve.
5. Active interview — chooses high-information pairwise questions instead of asking everything.
6. Preference consistency — detects contradictory pairwise criterion comparisons.
7. Decision objectives — expected value, risk-adjusted, regret-minimizing, robust, upside and resource-efficient modes.
8. Pareto exploration — surfaces non-dominated alternatives.
9. Scenario lab — compare alternate assumptions and priority shocks.
10. Correlation-aware criteria — shared groups reduce double-counting among related criteria.
11. Causal Lab — explicit causal graph + intervention analysis. This is hypothesis testing over user-entered relationships, not automatic causal discovery.
12. Group decisions — multiple private preference profiles and consensus/disagreement views.
13. Negotiation Lab — ranks candidate proposals using average, fairness and Pareto-like objectives.
14. Resource-constrained optimization — budget / time / risk constrained combination search.
15. Portfolio decisions — choose combinations of options rather than only a single winner.
16. Time-sensitive utility — multi-stage and long-horizon discounting.
17. Decision decay — detects stale assumptions and recommends refreshes.
18. Post-decision learning — outcome feedback updates learned option preferences.
19. Calibration — tracks prediction error and historical outcome quality.
20. Counterfactual Lab — explores modeled "what if we chose another option?" scenarios with uncertainty kept visible.
21. Explainability — criterion contribution breakdowns, sensitivity, assumptions and model traces.
22. Decision replay — records learning / analysis / outcome events for later reconstruction.
23. Decision benchmarking — compares saved-decision count, prediction error and satisfaction across the user's own history.
24. Domain packs — purchase, career, education, business, technology, projects, housing, travel, team, software and investment-study templates.

## Learning and modeling

The live engine uses interpretable local methods:

- Bradley–Terry-style pairwise preference updates.
- Shrinking posterior-style uncertainty for learned preferences.
- Local feature-hashed semantic memory for related criteria.
- Triangular score distributions for uncertain assessments.
- Monte Carlo simulation for robustness.
- Sensitivity and Pareto analysis.
- Online outcome calibration.
- LocalStorage for persistent preferences and decision history.

The site does not send decision data to a server by default.

## GitHub Pages

The repository includes a GitHub Pages deployment workflow at .github/workflows/pages.yml.

Expected Pages URL:

https://chessnerd69mmtz-pixel.github.io/Decision-Lab-/

## Important interpretation note

Decision Lab is a decision-support tool. It exposes assumptions and modeled consequences; it does not guarantee the correct real-world outcome. Causal results depend on the causal relationships entered by the user and should not be interpreted as automatically discovered causal facts.
