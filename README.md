# Joe — digital contact card

Live card with three tabs — **📇 Contact · 🛠 Work · 📄 CV** — an AI assistant called **Gaby**, and a hidden fruit-slicing game (🍉).

## Upload
Upload **everything in this folder** to the root of your GitHub Pages repo (Settings → Pages → Deploy from branch → `main` / root). Nothing needs editing.

```
index.html                      the card (boot screen, tabs, viewer, CV)
gaby.js                         Gaby, the assistant widget
site-config.js                  links, Worker URL, work samples list
samples/hp-prestige/            laptop-store demo (bilingual EN / فارسی)
samples/research-ml-platform/   MLOps platform: case-study page + full source
worker/deepseek-proxy-worker.js Cloudflare Worker (adds Gaby's /gaby route)
.nojekyll                       tells GitHub Pages to serve files as-is
```

## Gaby
- Quick-reply buttons and common questions are answered instantly from built-in knowledge, so Gaby works even offline.
- Free-text questions go to the AI through your Cloudflare Worker at `<WORKER_URL>/gaby`. If the Worker can't be reached she falls back to the built-in answers.
- She can act: open the Work or CV tab, launch a demo, or open WhatsApp / LinkedIn.
- **To switch the AI on:** Cloudflare dashboard → your Worker → *Edit code* → paste `worker/deepseek-proxy-worker.js` → *Deploy*. Your existing variables stay as they are. If this card is not on `https://josephsjr96.github.io`, add its address to `ALLOWED_ORIGINS` (comma-separated).

## CV
The CV tab is built from the projects in this repo. To add a downloadable PDF, put a file called **`cv.pdf`** next to `index.html` — the *Download CV* button appears by itself. *Save this page as PDF* prints just the CV.

## Editing later
Links, the Worker URL and the three work samples are all in `site-config.js`. To add a sample, put its folder under `samples/` and add one entry to the list.

## Notes
- The HP Prestige page is an independent demo and is not affiliated with HP.
- The ML platform runs with Docker (`docker compose up`); on the site it is shown as a case study with the full source in the repo.
