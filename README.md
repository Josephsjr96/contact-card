# Joe Sanjari — portfolio and CV

Static GitHub Pages portfolio with Contact, Work and CV sections. No build tools or external fonts are required in the browser. Navigation and PDF downloads work without JavaScript.

- `index.html` — profile, projects and full CV
- `cv.pdf` — current one-page general CV: Python & AI Software Developer
- `cv-data.json` — shared CV content for the page, print source and plain-text version
- `cv.html`, `cv-print.css`, `cv.txt` — generated print source, print styling and plain-text CV
- `site-config.js` — public project links and assistant service configuration
- `styles.css` — responsive dark visual design and print styling
- `app.js` — navigation highlighting and assistant project actions
- `gaby.js` — optional assistant with local answers and an external AI fallback
- `samples/` — project case studies and retained source examples

## Update content

Edit `cv-data.json` or `site-config.js`, then run `python build.py` (requires Python 3 and Node.js). This generates `index.html`, `cv.html` and `cv.txt`. Profile introduction and strengths live in `site-config.js`. Keep the assistant's factual replies in `gaby.js` aligned when updating professional positioning.

Regenerate `cv.pdf` from `cv.html` with Chromium, using its print CSS and no browser headers/footers:

```sh
chromium --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PWD/cv.pdf" "file://$PWD/cv.html"
```

Check the PDF page count, readable layout and extracted text before publishing. The current general CV fits one A4 page at 10-point body text. Publish generated files alongside their sources; the page and PDF must contain the same CV content.

## General professional profile — November 2026

The card now presents Python development and AI/ML systems alongside practical problem solving and technical communication. The introduction, strengths, selected-project order, CV and assistant share this positioning. Employer-specific application CVs remain separate. Existing employment dates, education, languages and certifications are retained; project claims distinguish independent work, team contributions and research validation.

## Local preview

Run `python -m http.server 8080 --directory .` and visit http://localhost:8080. GitHub Pages publishes the repository through the existing deployment workflow.

## Assistant

Common questions are answered locally. Other questions may be sent to the existing service configured in `WORKER_URL`; this is disclosed inside the assistant. No chat history is saved by this page. Service failures produce a useful local fallback. The assistant does not promise availability or invent qualifications.

## Verification

`tests/browser.cjs` checks navigation, CV content, the actual PDF download, project links, no-JavaScript access, assistant keyboard behavior, failure handling and responsive overflow. Set `PLAYWRIGHT_MODULE` to an installed Playwright module and `BASE_URL` to the preview or deployed site. Browser screenshots and reports are kept locally under `qa/`.

## Intro, waves and project films

The root page shows a 3.5-second welcome once per browser session. Its startup is embedded before the main content, so slow-loading scripts cannot make the page flash before the intro. Skip intro and Escape dismiss it immediately. Hash links such as `#cv` and `#films`, reduced-motion visitors and JavaScript-disabled visits bypass it.

`waves.js` adapts the geometric field from the local Nix app (`codex-ui/codexUI.html`) for slow ambient motion. Pause waves is in the footer; reduced-motion preferences and background-tab suspension are respected. No conversation or application bridge code is included.

`films.json` supplies the Project Films content. Native video players use `preload="none"`, inline playback, original audio and no autoplay. Starting another film pauses the previous one. The MP4 files in `media/` are losslessly remuxed with fast-start metadata for web playback; JPG files are extracted preview frames. All films also have a direct download and a text summary.
