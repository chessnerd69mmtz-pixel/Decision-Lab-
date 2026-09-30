# Decision Lab

Decision Lab is a privacy-first, GitHub Pages-friendly adaptive multi-criteria decision engine. It learns tradeoffs from pairwise questions, carries preference signals across decisions, stress-tests rankings, and closes the loop with outcome feedback.

## What makes it different

- **Bradley–Terry-style pairwise preference learning** rather than static weights.
- **Active learning** chooses ambiguous, high-leverage questions first.
- **Uncertainty tracking** keeps confidence from becoming fake precision.
- **Local semantic memory** uses feature-hashed text vectors + cosine similarity to connect related criteria without uploading text.
- **Outcome feedback** turns satisfaction/quality into a reward signal for future decisions.
- **Pareto frontier** separates efficient options from dominated ones.
- **Sensitivity analysis** shows which assumptions can flip the leader.
- **Monte Carlo robustness** samples 5,000 plausible preference profiles.
- **Value-of-information proxy** suggests what to learn next.
- **Scenario lab** lets you test alternate priorities.
- **Export/import** keeps the learned profile portable.
- **No API key or backend** is required for core functionality.

## Run locally

Open index.html in a browser, or serve the folder with any static server.

Example:

```bash
python -m http.server 8080
```

Then open http://localhost:8080.

## GitHub Pages

This project is structured for GitHub Pages and includes a Pages workflow under .github/workflows/pages.yml.

## Learning model notes

The system intentionally favors interpretable local methods instead of a black-box model. Pairwise observations update a logistic/Bradley–Terry-style latent preference score. Criterion uncertainty is reduced as evidence accumulates. Semantic memory uses feature hashing to avoid network calls while still connecting related words. Outcome feedback performs an online reward update.

These methods are decision-support heuristics, not a guarantee of correctness. The interface is designed to keep the human decision-maker in control and make assumptions inspectable.
