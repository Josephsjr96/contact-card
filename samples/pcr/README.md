# VESPER PCR — public portfolio demo

Live browser-only PCR/qPCR simulation, served by the contact card's GitHub Pages deployment at `samples/pcr/`. The Work card uses the portfolio's existing project-card renderer and launches the functioning app directly. `guide.html` documents import support and scientific scope.

Based on the VESPER laboratory source commit `6e3b43b`. `engine.js` is copied unchanged from that snapshot (engine version 0.2.0). `index.html` is the laboratory's original `prototype.html`, with portfolio navigation and more accurate import labels. `lab.js` differs only in the imported-DNA notification and notebook text. `lab.css` retains the original laboratory appearance. The private Sites publication is a separate deployment with unchanged access settings.

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
