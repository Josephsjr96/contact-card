/* Public configuration for the GitHub Pages contact card.
   Keep project URLs relative so the demos work at the site root and in local previews. */
window.SITE = {
  WORKER_URL: "https://flat-waterfall-436c.josephsanjari1996.workers.dev",
  whatsapp: "48730504025",
  whatsappText: "Hi Joe! I saw your contact card.",
  linkedin: "https://linkedin.com/in/yousef-sanjari-712947207",
  cvFile: "cv.pdf",

  samples: [
    {
      "id": "simon",
      "emoji": "🔎",
      "title": "SIMON",
      "kind": "Distributed AI · Inference-verification research",
      "desc": "A Rust peer-to-peer inference harness with libp2p transport, Ed25519-signed job receipts, admission control, and agent-to-agent job orchestration. Research measures audit cost and honest numerical drift across hardware.",
      "note": "Receipts bind a node to its answer; proof of model execution and automatic slashing remain open research.",
      "tags": [
        "Rust",
        "libp2p",
        "Ed25519",
        "LLM inference",
        "Verification"
      ],
      "cta": "View research & source",
      "url": "https://github.com/Josephsjr96/SIMON",
      "external": true
    },
    {
      id: "mlops",
      emoji: "🧠",
      title: "Research ML Platform",
      kind: "MLOps · Machine-translation research",
      desc: "A production-style ML lifecycle: register models, route 5% canary traffic, monitor metrics, then promote or automatically roll back. Includes a case-study walkthrough and full source code.",
      tags: ["Python", "FastAPI", "Docker Compose", "Redis", "Prometheus", "MLflow", "MinIO", "pytest"],
      cta: "View case study",
      url: "samples/research-ml-platform/index.html",
      external: false
    },
    {
      id: "translator",
      emoji: "🌐",
      title: "Multilingual Poetic Translator",
      kind: "NLP research · Persian ↔ German ↔ Polish",
      desc: "A research desktop app for comparing NLLB-200 and M2M100 on literary translation, with BLEU and semantic-similarity metrics, poetic-feature analysis, structured human evaluation, collaboration tools, analytics, and JSON/CSV export.",
      tags: ["Python", "NLP", "NLLB-200", "M2M100", "Machine Translation", "Poetry", "BLEU", "Human Evaluation"],
      note: "20 October 2026: 49 successful HTTP generations, 22 evidence checks, 47 Python tests, and five HTTP regression scenarios. Validates local version integrity and rollback with untrained adapter fixtures; translation quality is not established.",
      cta: "View research & source",
      url: "https://github.com/Josephsjr96/NLP-project-Multilanguage-poetic-translator",
      external: true
    },
    {
      "id": "animation",
      "emoji": "🎬",
      "title": "Animation Production Workspace",
      "kind": "Creative tools · Storyboard scanning",
      "desc": "A production-workspace MVP that imports scanned storyboards, detects panels with image processing, extracts shot details with OCR, and lets users review corrections before merging them into shots.",
      "tags": [
        "Python",
        "OCR",
        "Tesseract",
        "Image processing",
        "Storyboard"
      ],
      "cta": "View source",
      "url": "https://github.com/Josephsjr96/Animating-platform",
      "external": true
    },
    {
      id: "polish",
      emoji: "🇵🇱",
      title: "Polish A1",
      kind: "Language-learning PWA · Offline practice",
      desc: "An installable, offline-capable Polish-learning app with everyday dialogues, grammar notes, browser pronunciation, quizzes, saved exam scores, and personal word lists.",
      tags: ["PWA", "JavaScript", "Language learning", "Offline"],
      cta: "View source",
      url: "https://github.com/Josephsjr96/PolishA1-app",
      external: true
    }
  ]
};
