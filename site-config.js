/* Public project links. No credentials belong in this file. */
window.SITE = {
  WORKER_URL: "https://flat-waterfall-436c.josephsanjari1996.workers.dev",
  whatsapp: "48730504025",
  whatsappText: "Hi Joe, I saw your portfolio and would like to get in touch.",
  linkedin: "https://linkedin.com/in/yousef-sanjari-712947207",
  cvFile: "cv.pdf",
  profile: {
    title: "Python & AI Software Developer",
    introduction: "I'm Yousef (Joseph) Sanjari, a Python and AI developer based in Warsaw. I turn complex technical problems into working tools: APIs, model evaluation systems and interactive applications. My background in IT support keeps the focus on solving the problem and making the result useful to people.",
    strengths: [
      {title:"Practical problem solving", text:"I trace problems through hardware, software and workflows. That approach connects my IT support experience with the developer tools and applications I build today."},
      {title:"Systems thinking", text:"I connect APIs, data, model evaluation and interfaces, with tests and validation that make it clear what works and what still needs review."},
      {title:"Clear technical communication", text:"I make complex work easier to understand through dashboards, documentation and visual explainers, drawing on experience helping people with different technical backgrounds."}
    ]
  },
  samples: [
    {id:"data-explorer", title:"Data Explorer", kind:"Data analysis & reporting",
     desc:"A Python dashboard that cleans movie data and presents genre comparisons, summary statistics and ranked tables.",
     note:"Academic project · Real movie titles; simulated ratings and financial data.",
     tags:["Python","Pandas","NumPy","PySide6"], cta:"Read the case study", url:"samples/data-explorer/", external:false},
    {id:"mlops", title:"Research ML Platform", kind:"Dashboards & model monitoring",
     desc:"A Streamlit dashboard and Python services for tracking model versions, evaluation results and canary deployments.",
     note:"Research prototype · Local validation is separate from production readiness.",
     tags:["Python","SQL/SQLite","Streamlit","Prometheus"], cta:"Read the case study", url:"samples/research-ml-platform/", external:false},
    {id:"translator", title:"Multilingual Poetic Translator", kind:"NLP evaluation & research",
     desc:"A research application comparing Persian, German and Polish translations through model outputs, metrics and structured human ratings.",
     note:"Engineering tests establish version integrity; linguistic quality review is separate.",
     tags:["Python","NLLB-200","SQLite","Human evaluation"], cta:"View on GitHub", url:"https://github.com/Josephsjr96/NLP-project-Multilanguage-poetic-translator", external:true},
    {id:"simon", title:"SIMON", kind:"Distributed AI · Team project",
     desc:"Contributed to inference workflows across different hardware, signed output receipts and experiments on AMD MI300X.",
     note:"A receipt binds a node to its answer; it does not prove which model executed.",
     tags:["LLM inference","Verification","Performance analysis"], cta:"View on GitHub", url:"https://github.com/Josephsjr96/SIMON", external:true},
    {id:"videos", title:"Technical Explainer Videos", kind:"Visual communication",
     desc:"Created motion-graphics explainers for MLOps, SIMON and AI Behavior Lab, using animated diagrams, metric panels and captions to explain technical workflows.",
     note:"Watch SIMON, Canary MLOps and Water Tank in Project Films.",
     tags:["Data storytelling","Motion graphics","Technical communication"], cta:"Watch project films", url:"#films", external:false},
    {id:"animation", title:"Animation Production Workspace", kind:"Creative production tools",
     desc:"Flask workflows for storyboards, shots and schedules, alongside a React/TypeScript/PixiJS scene-editor prototype with undo/redo and validated project import/export.",
     note:"Production workspace and editor prototypes · Features and validation scope are documented separately.",
     tags:["Python","Flask","React","TypeScript","PixiJS"], cta:"View on GitHub", url:"https://github.com/Josephsjr96/Animating-platform", external:true},
    {id:"rulebox", title:"Rulebox", kind:"Local developer tools",
     desc:"A Python and SQLite instruction manager with a browser interface, reviewed file updates, backups and stale-preview checks.",
     tags:["Python","SQLite","JavaScript"], cta:"View on GitHub", url:"https://github.com/Josephsjr96/rulebox", external:true},
    {id:"space-duel", group:"games", title:"Space Ship Duel", kind:"Independent game project · Desktop arcade",
     desc:"A Python/Pygame space shooter that connects responsive combat, weapon progression and a six-world frontier journey. Built around readable action, a cinematic opening and clear objectives between encounters.",
     note:"Gameplay programming, interface design, visual direction and automated testing. Planet and nebula artwork created with AI-assisted generation and integrated into the game.",
     tags:["Python","Pygame CE","Game design","Procedural VFX"], cta:"Read the case study", url:"samples/space-duel/", external:false,
     repo:"https://github.com/Josephsjr96/space-ship-duel", sourceLabel:"GitHub source · access required"},
    {id:"polish", title:"Polish A1", kind:"Language learning",
     desc:"An offline-capable learning app with everyday dialogues, grammar notes, pronunciation and quizzes.",
     tags:["JavaScript","PWA","Education"], cta:"View on GitHub", url:"https://github.com/Josephsjr96/PolishA1-app", external:true}
  ]
};
