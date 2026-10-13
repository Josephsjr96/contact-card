/* gaby.js — "Gaby", Joe's assistant. Floating chat like a helpdesk bot, plus an AI agent.
   • Quick replies and common questions are answered instantly from built-in knowledge (works offline).
   • Free-text questions go to the AI through your Cloudflare Worker (<WORKER_URL>/gaby).
   • If the AI can't be reached, Gaby falls back to her built-in knowledge — she never just breaks.
   • She can act: open the Work / CV tabs, launch a demo, or open WhatsApp / LinkedIn.
   Needs: site-config.js (window.SITE) and the PORTFOLIO helper from index.html. */
(function () {
  const S = window.SITE || {};
  const WORKER = (S.WORKER_URL || "").replace(/\/$/, "");
  const WA = "https://wa.me/" + (S.whatsapp || "48730504025");
  const HKEY = "gaby_hist_v1";
  const esc = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const fold = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

  /* ---------- knowledge ---------- */
  const SYSTEM = `You are Gaby, the friendly digital assistant on Joe's contact card (Joe Sanjari, Warsaw, Poland). You only speak for Joe's website.
FACTS (use only these, never invent anything else):
- Joe is a Software & Systems Engineer working in AI / NLP, MLOps and full-stack development, based in Warsaw. Languages: Arabic, Persian, English, German; he is learning Polish.
- Contact: WhatsApp and phone +48 730 504 025, LinkedIn (yousef-sanjari), GitHub @Josephsjr96.
- Work samples (the Work tab): 1) HP Prestige Collection - a bilingual English/Persian laptop-store demo with six-laptop catalogue, comparison table, FAQ, right-to-left layout and a built-in assistant (independent demo, not affiliated with HP). 2) Research ML Platform - MLOps: train, register, 5% canary, monitor, promote or automatic rollback; FastAPI, Docker Compose (9 containers), Redis, Prometheus, MLflow, MinIO, LoRA fine-tuning of NLLB-200 for Persian-German-Polish poetic translation, Streamlit dashboard, 17 passing tests. 3) Polish A1 - an installable PWA for learning Polish with a pronunciation engine, dictionary, story-based Easy Mode and an AI tutor agent through a Cloudflare Worker.
- The CV tab lists skills, projects and languages; full work history and education are on LinkedIn; a PDF CV may be downloadable there.
- The card hides a fruit-slicing mini-game behind the watermelon button.
RULES: Be warm and concise (max 70 words). Reply in the language the visitor writes in. If asked about salary, availability, years of experience, employers, education or anything not in FACTS, say you don't have that and suggest messaging Joe on WhatsApp or LinkedIn. Never promise anything on Joe's behalf. Don't do general tasks (code, essays, homework); politely steer back to Joe and his work.
ACTIONS: you may end a reply with at most ONE tag that shows a button: [[open:work]] [[open:cv]] [[open:hp]] [[open:mlops]] [[open:polish]] [[open:whatsapp]] [[open:linkedin]].`;

  const ACTIONS = {
    work: { label: "🛠 Open Work tab", run: () => { PORTFOLIO.show("work"); } },
    cv: { label: "📄 Open CV tab", run: () => { PORTFOLIO.show("cv"); } },
    hp: { label: "💻 Open laptop-store demo", run: () => { PORTFOLIO.show("work"); PORTFOLIO.open("hp"); } },
    mlops: { label: "🧠 Open MLOps case study", run: () => { PORTFOLIO.show("work"); PORTFOLIO.open("mlops"); } },
    polish: { label: "🇵🇱 Open Polish app", run: () => { PORTFOLIO.open("polish"); } },
    whatsapp: { label: "💬 WhatsApp Joe", run: () => window.open(WA + "?text=" + encodeURIComponent(S.whatsappText || "Hi Joe!"), "_blank", "noopener") },
    linkedin: { label: "in LinkedIn", run: () => window.open(S.linkedin, "_blank", "noopener") }
  };

  /* offline answers: keywords (folded) -> reply + buttons */
  const FAQ = [
    { k: ["hello", "hi ", "hey", "cześć", "czesc", "salam", "سلام", "hallo", "good morning", "good evening"], a: "Hi! I'm Gaby, Joe's assistant. I can tell you about Joe, show his work samples, or connect you with him. What would you like?", b: ["work"] },
    { k: ["who", "about joe", "tell me about", "introduce", "background"], a: "Joe is a Software & Systems Engineer in Warsaw working across **AI / NLP**, **MLOps** and **full-stack** development. He builds machine-translation research tools, the infrastructure that ships models safely, and polished web apps.", b: ["work", "cv"] },
    { k: ["mlops", "ml platform", "research platform", "canary", "rollback", "machine learning", "model deploy"], a: "The **Research ML Platform** is Joe's MLOps project: train → register → 5% canary → monitor → promote or automatic rollback. FastAPI, Docker Compose (9 containers), Redis, Prometheus, MLflow, MinIO and a Streamlit dashboard, with 17 passing tests. It supports his Persian ↔ German ↔ Polish poetic-translation research.", b: ["mlops"] },
    { k: ["laptop", "hp ", "store", "shop", "prestige", "ecommerce", "e-commerce"], a: "The **HP Prestige Collection** is a bilingual (English / Persian, with right-to-left layout) laptop-store demo: six-machine catalogue, comparison table, FAQ and a built-in assistant. It's an independent demo, not affiliated with HP.", b: ["hp"] },
    { k: ["polish", "polski", "learning app", "a1", "tutor"], a: "**Polish A1** is Joe's installable app for learning Polish — pronunciation engine, dictionary, story-based Easy Mode and an AI tutor agent. Joe is learning Polish himself, so it's built from real experience.", b: ["polish"] },
    { k: ["work", "project", "portfolio", "sample", "demo", "built", "prototype"], a: "Joe's samples: **HP Prestige Collection** (bilingual store demo), **Research ML Platform** (MLOps with canary deploys and auto-rollback) and **Polish A1** (PWA with an AI tutor). Pick one and I'll open it.", b: ["hp", "mlops", "polish"] },
    { k: ["cv", "resume", "résumé", "curriculum", "skills", "experience", "education", "stack", "technolog"], a: "The **CV tab** lists Joe's skills, projects and languages, and you can save it as a PDF. For his full work history and education, LinkedIn is the best place.", b: ["cv", "linkedin"] },
    { k: ["language", "speak", "arabic", "persian", "farsi", "german", "english"], a: "Joe works in **Arabic, Persian, English and German**, and he's currently learning **Polish**.", b: [] },
    { k: ["contact", "reach", "talk to joe", "message", "email", "call", "phone", "whatsapp", "number", "hire", "available", "availability", "freelance", "salary", "rate", "price", "cost", "job", "opportunit"], a: "The quickest way to reach Joe is **WhatsApp or a call on +48 730 504 025**, or LinkedIn. For things like availability, rates or role details I don't have the answer — he does.", b: ["whatsapp", "linkedin"] },
    { k: ["where", "location", "warsaw", "poland", "city", "based", "time zone"], a: "Joe is based in **Warsaw, Poland** (CET / CEST).", b: [] },
    { k: ["game", "egg", "watermelon", "fruit", "secret", "play"], a: "Psst — tap the 🍉 button at the bottom-left of the page. Swipe to slice, and don't miss more than three!", b: [] },
    { k: ["thank", "thanks", "dzieki", "dziekuje", "merci", "danke", "ممنون", "مرسی"], a: "You're welcome! Anything else you'd like to know about Joe?", b: [] },
    { k: ["who are you", "your name", "are you ai", "are you a bot", "gaby"], a: "I'm **Gaby**, Joe's digital assistant — part scripted, part AI. I can answer questions about Joe and open his work for you.", b: ["work"] }
  ];
  const FALLBACK = { a: "I can't reach my AI brain right now, but I can still help with Joe's **work**, **CV**, **languages** or **contact details**. Or message Joe directly on WhatsApp.", b: ["work", "whatsapp"] };

  function localAnswer(text) {
    const t = " " + fold(text) + " ";
    let best = null, top = 0;
    FAQ.forEach(f => { const s = f.k.reduce((n, k) => n + (t.includes(fold(k)) ? 1 : 0), 0); if (s > top) { top = s; best = f; } });
    return best || null;
  }

  const CHIPS = [
    { t: "👤 Who is Joe?", q: "who is joe" }, { t: "🛠 Work samples", q: "work samples" },
    { t: "🧠 MLOps platform", q: "mlops platform" }, { t: "💻 Laptop store", q: "laptop store demo" },
    { t: "📄 CV", q: "cv skills" }, { t: "💬 Talk to Joe", q: "__talk__" }
  ];

  /* ---------- UI ---------- */
  const css = document.createElement("style");
  css.textContent = `
  #gaby-fab{position:fixed;right:18px;bottom:calc(22px + env(safe-area-inset-bottom,0px));width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;z-index:90;
    background:linear-gradient(135deg,#7c3aed,#00d4ff);color:#fff;font:900 1.5rem Inter,sans-serif;box-shadow:0 8px 28px rgba(124,58,237,.55);transition:transform .2s ease}
  #gaby-fab:hover{transform:scale(1.07)}#gaby-fab.open{display:none}
  #gaby-fab::after{content:"";position:absolute;right:3px;top:3px;width:13px;height:13px;border-radius:50%;background:#22c55e;border:2px solid #05050a}
  #gaby-tip{position:fixed;right:20px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:90;max-width:230px;padding:11px 14px;border-radius:16px 16px 4px 16px;
    background:#fff;color:#111;font:500 .82rem/1.4 Inter,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);display:none;cursor:pointer;animation:gtip .4s ease}
  #gaby-tip.show{display:block}#gaby-tip b{color:#7c3aed}
  @keyframes gtip{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  #gaby-panel{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));width:min(390px,calc(100vw - 28px));height:min(74vh,580px);z-index:95;display:flex;flex-direction:column;overflow:hidden;
    background:#0d0d15;border:1px solid rgba(255,255,255,.12);border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.65);
    opacity:0;visibility:hidden;transform:translateY(18px) scale(.98);transition:all .25s ease;font-family:Inter,sans-serif;color:#f5f5f7}
  #gaby-panel.open{opacity:1;visibility:visible;transform:none}
  .gb-h{display:flex;align-items:center;gap:11px;padding:13px 15px;background:linear-gradient(135deg,#4c1d95,#7c3aed)}
  .gb-av{position:relative;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#7c3aed);display:flex;align-items:center;justify-content:center;font-weight:900;border:2px solid rgba(255,255,255,.35)}
  .gb-av::after{content:"";position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid #4c1d95}
  .gb-h .t{flex:1;line-height:1.2}.gb-h b{font-size:.98rem}.gb-h small{display:block;opacity:.85;font-size:.7rem;margin-top:1px}
  .gb-h button{background:none;border:none;color:#fff;font-size:1.05rem;cursor:pointer;padding:5px 7px;border-radius:8px}.gb-h button:hover{background:rgba(255,255,255,.15)}
  .gb-b{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:#08080e;overscroll-behavior:contain}
  .gb-m{max-width:86%;padding:10px 14px;border-radius:17px;font-size:.87rem;line-height:1.5;word-wrap:break-word;animation:gbin .22s ease}
  @keyframes gbin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
  .gb-m.a{background:#1a1a26;border:1px solid rgba(255,255,255,.07);border-top-left-radius:5px;align-self:flex-start}
  .gb-m.u{background:linear-gradient(135deg,#7c3aed,#5b21b6);border-top-right-radius:5px;align-self:flex-end}
  .gb-m b{color:#00d4ff}.gb-m.u b{color:#fff}
  .gb-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
  .gb-acts button,.gb-form button{padding:8px 12px;border-radius:11px;border:none;cursor:pointer;font:700 .78rem Inter,sans-serif;background:#00d4ff;color:#04121a}
  .gb-acts button.wa,.gb-form button{background:#25d366;color:#04210f}
  .gb-form textarea{width:100%;margin-top:8px;padding:9px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0d0d15;color:#f5f5f7;font:.84rem Inter,sans-serif;resize:none}
  .gb-form button{margin-top:8px}
  .gb-typing{display:flex;gap:5px;padding:12px 15px;background:#1a1a26;border:1px solid rgba(255,255,255,.07);border-radius:17px;border-top-left-radius:5px;align-self:flex-start}
  .gb-typing i{width:7px;height:7px;border-radius:50%;background:#8a8a99;animation:gbdot 1.3s infinite ease-in-out}
  .gb-typing i:nth-child(2){animation-delay:.2s}.gb-typing i:nth-child(3){animation-delay:.4s}
  @keyframes gbdot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
  .gb-q{display:flex;flex-wrap:wrap;gap:6px;padding:9px 12px 2px;background:#0d0d15}
  .gb-q button{padding:7px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.14);background:#171723;color:#e8e8f0;font:600 .75rem Inter,sans-serif;cursor:pointer}
  .gb-q button:hover{border-color:#7c3aed;background:#201a3a}
  .gb-f{display:flex;gap:8px;padding:10px 12px 12px;background:#0d0d15}
  .gb-f input{flex:1;min-width:0;padding:11px 15px;border-radius:99px;border:1px solid rgba(255,255,255,.14);background:#171723;color:#f5f5f7;font:.88rem Inter,sans-serif;outline:none}
  .gb-f input:focus{border-color:#7c3aed}
  .gb-f button{width:42px;height:42px;border-radius:50%;border:none;background:linear-gradient(135deg,#7c3aed,#00d4ff);color:#fff;font-size:1rem;cursor:pointer;flex-shrink:0}
  .gb-f button:disabled{opacity:.5}
  @media(max-width:480px){#gaby-panel{right:0;bottom:0;width:100vw;height:86vh;border-radius:20px 20px 0 0;border-bottom:none}}`;
  document.head.appendChild(css);

  const fab = document.createElement("button");
  fab.id = "gaby-fab"; fab.setAttribute("aria-label", "Chat with Gaby, Joe's assistant"); fab.textContent = "G";
  const tip = document.createElement("div");
  tip.id = "gaby-tip"; tip.innerHTML = "Hi, I'm <b>Gaby</b> 👋<br>Ask me about Joe's work.";
  const panel = document.createElement("div");
  panel.id = "gaby-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Chat with Gaby");
  panel.innerHTML = `<div class="gb-h"><div class="gb-av">G</div><div class="t"><b>Gaby</b><small>Joe's assistant · online</small></div>
    <button id="gb-new" title="New chat" aria-label="New chat">🗑</button><button id="gb-x" title="Close" aria-label="Close chat">✕</button></div>
    <div class="gb-b" id="gb-body" aria-live="polite"></div><div class="gb-q" id="gb-q"></div>
    <div class="gb-f"><input id="gb-in" maxlength="300" placeholder="Type your message…" autocomplete="off"><button id="gb-send" aria-label="Send">➤</button></div>`;
  document.body.appendChild(fab); document.body.appendChild(tip); document.body.appendChild(panel);

  const body = panel.querySelector("#gb-body"), input = panel.querySelector("#gb-in"), sendBtn = panel.querySelector("#gb-send");
  let hist = [], busy = false, last = 0, sent = 0;
  try { hist = JSON.parse(localStorage.getItem(HKEY) || "[]").slice(-16); } catch (e) {}
  const save = () => { try { localStorage.setItem(HKEY, JSON.stringify(hist.slice(-16))); } catch (e) {} };

  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  function bubble(cls, html) { const d = document.createElement("div"); d.className = "gb-m " + cls; d.innerHTML = html; body.appendChild(d); body.scrollTop = body.scrollHeight; return d; }
  function typing(on) {
    const o = panel.querySelector("#gb-typing"); if (o) o.remove();
    if (on) { const d = document.createElement("div"); d.className = "gb-typing"; d.id = "gb-typing"; d.innerHTML = "<i></i><i></i><i></i>"; body.appendChild(d); body.scrollTop = body.scrollHeight; }
  }
  function withActions(el, keys) {
    keys.filter(k => ACTIONS[k]).forEach((k, i) => { if (!i) { const w = document.createElement("div"); w.className = "gb-acts"; el.appendChild(w); } });
    const w = el.querySelector(".gb-acts"); if (!w) return;
    keys.filter(k => ACTIONS[k]).forEach(k => {
      const b = document.createElement("button"); b.textContent = ACTIONS[k].label; if (k === "whatsapp") b.className = "wa";
      b.onclick = () => { if (k !== "whatsapp" && k !== "linkedin") close(); ACTIONS[k].run(); };
      w.appendChild(b);
    });
  }
  function botSay(text, keys) {
    const el = bubble("a", fmt(text)); if (keys && keys.length) withActions(el, keys);
    body.scrollTop = body.scrollHeight; return el;
  }
  function talkForm() {
    const el = bubble("a", "Happy to connect you with Joe. Tell me what to say (optional) and I'll open WhatsApp with it ready to send.");
    const f = document.createElement("div"); f.className = "gb-form";
    const lastUser = [...hist].reverse().find(m => m.role === "user");
    f.innerHTML = '<textarea rows="3" placeholder="e.g. Hi Joe, I\'d like to talk about a project…"></textarea><button type="button">💬 Open WhatsApp</button>';
    el.appendChild(f);
    f.querySelector("button").onclick = () => {
      const msg = f.querySelector("textarea").value.trim() || (lastUser && lastUser.content !== "__talk__" ? "Hi Joe! " + lastUser.content : S.whatsappText || "Hi Joe!");
      window.open(WA + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    };
  }

  function renderChips() {
    panel.querySelector("#gb-q").innerHTML = CHIPS.map((c, i) => `<button data-i="${i}">${esc(c.t)}</button>`).join("");
  }
  function renderAll() {
    body.innerHTML = "";
    botSay("Hi, I'm **Gaby**, Joe's assistant! 👋 Ask me anything about Joe, his work samples or how to reach him — or tap a button below.");
    hist.forEach(m => m.role === "user" ? (m.content === "__talk__" ? 0 : bubble("u", esc(m.content))) : bubble("a", fmt(m.content)));
    renderChips();
  }

  /* ---------- AI ---------- */
  async function askAI() {
    if (!WORKER) throw new Error("NOWORKER");
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(WORKER + "/gaby", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify({ messages: [{ role: "system", content: SYSTEM }].concat(hist.filter(m => m.content !== "__talk__").slice(-8)), max_tokens: 300, temperature: 0.5 })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const j = await res.json(), txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!txt) throw new Error("EMPTY");
      return txt.trim();
    } finally { clearTimeout(t); }
  }
  function splitActions(txt) {
    const keys = []; txt = txt.replace(/\[\[open:(\w+)\]\]/g, (m, k) => { if (ACTIONS[k] && !keys.includes(k)) keys.push(k); return ""; }).trim();
    return { txt, keys: keys.slice(0, 2) };
  }

  /* ---------- flow ---------- */
  function done() { busy = false; sendBtn.disabled = false; typing(false); }

  async function ask(text, opts) {
    opts = opts || {};
    text = (text || "").trim(); if (!text || busy) return;
    if (!opts.chip) {
      if (Date.now() - last < 1500) return;
      if (sent >= 40) { botSay("We've chatted a lot! For anything more, message Joe directly 🙂", ["whatsapp"]); return; }
      last = Date.now(); sent++;
    }
    input.value = ""; bubble("u", esc(opts.label || text));
    hist.push({ role: "user", content: text }); save();
    if (text === "__talk__") { hist.pop(); save(); return talkForm(); }

    busy = true; sendBtn.disabled = true;
    if (opts.chip) {                                   /* quick replies: instant, local */
      const f = localAnswer(text) || FALLBACK;
      typing(true);
      return setTimeout(() => { typing(false); hist.push({ role: "assistant", content: f.a }); save(); botSay(f.a, f.b); busy = false; sendBtn.disabled = false; }, 450);
    }
    typing(true);
    try {
      const raw = await askAI(), r = splitActions(raw);
      hist.push({ role: "assistant", content: r.txt }); save(); typing(false); botSay(r.txt, r.keys);
    } catch (e) {
      typing(false);
      const f = localAnswer(text) || FALLBACK;
      hist.push({ role: "assistant", content: f.a }); save(); botSay(f.a, f.b);
    }
    done();
  }

  function open() {
    panel.classList.add("open"); fab.classList.add("open"); tip.classList.remove("show");
    try { sessionStorage.setItem("gaby_tip", "1"); } catch (e) {}
    renderAll();
    if (window.matchMedia && matchMedia("(pointer:fine)").matches) input.focus();
  }
  function close() { panel.classList.remove("open"); fab.classList.remove("open"); }

  fab.onclick = open; tip.onclick = open;
  panel.querySelector("#gb-x").onclick = close;
  panel.querySelector("#gb-new").onclick = () => { hist = []; save(); renderAll(); };
  sendBtn.onclick = () => ask(input.value);
  input.addEventListener("keydown", e => { if (e.key === "Enter") ask(input.value); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && panel.classList.contains("open")) close(); });
  panel.querySelector("#gb-q").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    const c = CHIPS[+b.dataset.i]; ask(c.q, { chip: true, label: c.t.replace(/^[^\p{L}]+/u, "") });
  });

  /* friendly nudge once per visit, after the boot screen */
  function nudge() {
    try { if (sessionStorage.getItem("gaby_tip")) return; } catch (e) {}
    setTimeout(() => { if (!panel.classList.contains("open")) { tip.classList.add("show"); setTimeout(() => tip.classList.remove("show"), 9000); } }, 2500);
  }
  if (document.getElementById("boot") && document.getElementById("boot").style.display !== "none") window.addEventListener("boot-done", nudge, { once: true }); else nudge();

  window.GABY = { open, close, ask, localAnswer, SYSTEM };
})();
