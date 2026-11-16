# VESPER PCR — public portfolio demo

Live browser-only PCR/qPCR simulation, served by the contact card's GitHub Pages deployment at `samples/pcr/`. The Work card uses the portfolio's existing project-card renderer and launches the functioning app directly. `guide.html` documents import support and scientific scope.

Based on the VESPER laboratory source commit `6e3b43b`. `engine.js` retains that snapshot’s numerical model (engine version 0.2.0); its limitations text now describes the optional advisory layer. `index.html` is the laboratory's original `prototype.html`, with portfolio navigation and more accurate import labels. `lab.js` integrates the optional Gaby advisory UI while preserving engine ownership of results. `lab.css` supplies the core layout; `bench.css` and `bench.js` add refined laboratory materials, task lighting and an independently powered, rotating DNA nightlight. The private Sites publication is a separate deployment with unchanged access settings.

## Real-sequence support

The existing engine accepts single-record FASTA or raw DNA text with A/C/G/T/N, 20–20,000 bases. Files are read locally. Both user-supplied primers must be A/C/G/T and 15–35 nt. Inward-facing product search is limited to 2,000 bp on the supplied template. Whole genomes above the limit, multiple records, RNA, other IUPAC ambiguity symbols, FASTQ, AB1 and GenBank are unsupported. No clinical or experimental validity is inferred from simulated output.

Fixture: `tests/fixtures/NC_001416.1-1-400.fasta`, bases 1–400 of NCBI RefSeq NC_001416.1 (lambda), retrieved 16 November 2026 from:

https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_001416.1&rettype=fasta&retmode=text&seq_start=1&seq_stop=400

The terminal primer pair used in tests is a computational fixture, not an optimized or wet-lab-validated assay. The checked result demonstrates parsing, orientation, simulated product generation and export integrity, not biological performance.

## Verification

From the contact-card root:

```sh
node samples/pcr/tests/engine.test.cjs
node samples/pcr/tests/reference-import.test.cjs
BASE_URL=http://127.0.0.1:8088/ node tests/pcr.cjs
```

The browser test follows the actual Work link, imports the reference through the file input, supplies the fixture primers, checks sequence/product preservation in the downloaded run, tests contamination, visits the guide and checks responsive widths. It also checks the PCR assistant answer. Screenshots and observed results are written under ignored `qa/`.

## Gaby advisory (application 0.3.0)

`gaby-advisor.js` reuses `SITE.WORKER_URL`, the portfolio Gaby model service. Requests occur only after a completed run and a click on Explain. The projection includes generated labels (S1–S4, NTC, PC), rounded Cq/replicate metrics, protocol settings and allowlisted flags. It omits specimen names, DNA, primers, source IDs and session notes. There is no free-text prompt field.

The model returns structured observation/tip codes, never displayed raw prose. A strict field check, exact calls/Cq comparisons, per-run SHA-256 fingerprint and permitted-code checks reject unsupported claims. Wording comes from local templates. A failed control must remain INVALID and must prompt control-failure investigation. This is a constrained teaching advisor, not an unrestricted chat or scientific validation.

Requests time out after 30 seconds. Disabling Gaby or changing the run cancels pending work and discards its advice. Errors and rejected responses use explicitly local deterministic explanations. Export includes advisory status, verified structured output, the input fingerprint and the model name reported by the service. Checks run in the browser and do not establish a trusted backend or authenticated release flow.

Additional verification:

```sh
node samples/pcr/tests/gaby-advisor.test.cjs
node tests/pcr-gaby.cjs
GABY_LIVE=1 BASE_URL=https://josephsjr96.github.io/contact-card/ node tests/pcr-gaby.cjs
```

The normal browser suite mocks good, malicious, unavailable and delayed service responses. The explicit live mode calls the real Gaby service once. Current application behavior differs from the separate, earlier specialist-review PDF; specialist evaluation of the LLM advisory has not been performed.

## Bench visual update

The neutral-lit bench uses a light instrument enclosure, clearer typography and responsive chart axes. The tabletop DNA nightlight rotates only while powered (18-second revolution), stops under reduced-motion preferences, and pauses animation in hidden tabs. The task-light switch independently dims the room. These decorative controls do not change protocol time, sequences, run output or Gaby behavior. The same bench assets are mirrored in the standalone PCR repository.
