# CLAUDE.md

Personal portfolio site served by GitHub Pages from the root of `main`. Plain static HTML/CSS/JS: no build step, no package manager, no tests.

## Layout

- `index.html`, `main.js`, `styles.css` — the portfolio home page (intro animation, about, services, projects, contact).
- `thanks.html` — confirmation page shown after the contact form is sent; reuses `styles.css`.
- `assets/` — images for the home page.
- `.nojekyll` — keeps GitHub Pages from running Jekyll; do not delete it.
- `afterhours/` — a copy of the Afterhours store (customer `index.html`, `owner.html`, `privacy.html`, `js/` ES modules, `css/app.css`). It talks to Supabase project `qrcatzvlfitidakbsujy`; URL and publishable key live in `afterhours/js/config.js` (the publishable key is meant to be public; access is governed by database rules).
- `super-rr/` — SupeRR Pressure Selector dashboard (`index.html`, `app.js`, `styles.css`). Loads `data/core.json` and per-match `data/m/<key>.json` via `fetch`; report PDFs are in `files/`.

## Preview locally

Pages use ES modules and `fetch`, so open them over HTTP, not `file://`:

```sh
python3 -m http.server 8000
# http://localhost:8000/  ·  /afterhours/  ·  /super-rr/
```

Pushing to `main` deploys the site.
