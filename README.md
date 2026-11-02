# Joe Sanjari — portfolio and CV

Static GitHub Pages portfolio with Contact, Work and CV sections. No build tools or external fonts are required in the browser. Navigation and PDF downloads work without JavaScript.

- `index.html` — profile, projects and full CV
- `cv.pdf` — current one-page Business Intelligence & Data Analytics CV
- `cv-data.json` — CV content used to generate the HTML
- `site-config.js` — public project links and assistant service configuration
- `styles.css` — responsive dark visual design and print styling
- `app.js` — navigation highlighting and assistant project actions
- `gaby.js` — optional assistant with local answers and an external AI fallback
- `samples/` — project case studies and retained source examples

## Update content

Edit `cv-data.json` or `site-config.js`, then run `python build.py` (requires Python 3 and Node.js). Replace `cv.pdf` when changing the downloadable CV. Keep the PDF and page content consistent. Publish the generated `index.html` alongside the source files.

## Local preview

Run `python -m http.server 8080 --directory .` and visit http://localhost:8080. GitHub Pages publishes the repository through the existing deployment workflow.

## Assistant

Common questions are answered locally. Other questions may be sent to the existing service configured in `WORKER_URL`; this is disclosed inside the assistant. No chat history is saved by this page. Service failures produce a useful local fallback. The assistant does not promise availability or invent qualifications.

## Verification

`tests/browser.cjs` checks navigation, CV content, the actual PDF download, project links, no-JavaScript access, assistant keyboard behavior, failure handling and responsive overflow. Set `PLAYWRIGHT_MODULE` to an installed Playwright module and `BASE_URL` to the preview or deployed site. Browser screenshots and reports are kept locally under `qa/`.
