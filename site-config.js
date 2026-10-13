/* Public configuration for the GitHub Pages contact card.
   Keep project URLs relative so the demos work at the site root and in local previews. */
window.SITE = {
  WORKER_URL: "",
  whatsapp: "48730504025",
  whatsappText: "Hi Joe! I saw your contact card.",
  linkedin: "https://linkedin.com/in/yousef-sanjari-712947207",
  cvFile: "cv.pdf",

  samples: [
    {
      id: "hp",
      emoji: "💻",
      title: "HP Prestige Collection",
      kind: "Bilingual storefront demo · EN / فارسی",
      desc: "A polished laptop-store experience with a six-machine catalogue, side-by-side comparisons, FAQ, English/Persian language switching, RTL layout, and a built-in assistant.",
      note: "Independent demo; not affiliated with HP.",
      tags: ["HTML", "CSS", "JavaScript", "i18n", "RTL", "Responsive UI"],
      cta: "Live demo",
      url: "samples/hp-prestige/index.html",
      external: false
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
      id: "polish",
      emoji: "🇵🇱",
      title: "Polish A1",
      kind: "Language-learning PWA · AI tutor",
      desc: "An installable Polish-learning app with pronunciation practice, a dictionary, story-based Easy Mode, and an AI tutor agent.",
      tags: ["PWA", "JavaScript", "Language learning", "AI tutor"],
      cta: "View source",
      url: "https://github.com/Josephsjr96/PolishA1-app",
      external: true
    }
  ]
};
