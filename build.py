from pathlib import Path
from html import escape as e
import json,subprocess
ROOT=Path(__file__).parent
rows=json.loads((ROOT/'cv-data.json').read_text())
source=subprocess.check_output(['node','-e',"global.window={};require('./site-config.js');process.stdout.write(JSON.stringify(window.SITE));"],cwd=ROOT,text=True)
site=json.loads(source)
# Lead with projects that show engineering breadth; retain every project and URL.
order=['mlops','animation','rulebox','simon','data-explorer','translator','videos','polish']
games=[project for project in site['samples'] if project.get('group')=='games']
projects=[project for project in site['samples'] if project.get('group')!='games']
projects.sort(key=lambda project: order.index(project['id']))
profile=site['profile']
films=json.loads((ROOT/'films.json').read_text())
def card(p):
    ext=' target="_blank" rel="noopener noreferrer"' if p['external'] else ''
    suffix=' <span aria-hidden="true">↗</span>' if p['external'] else ' <span aria-hidden="true">→</span>'
    return f'''<article class="project" id="proj-{e(p['id'])}"><p class="kind">{e(p['kind'])}</p><h3>{e(p['title'])}</h3><p>{e(p['desc'])}</p>{'<p class="note">'+e(p['note'])+'</p>' if p.get('note') else ''}<ul class="tags" aria-label="Technologies and skills">{''.join('<li>'+e(t)+'</li>' for t in p['tags'])}</ul><a href="{e(p['url'])}"{ext}>{e(p['cta'])}{suffix}{'<span class="sr-only"> (opens in a new tab)</span>' if p['external'] else ''}</a></article>'''
def film(f):
    return f'''<article class="film" id="film-{e(f['id'])}"><div class="film-meta"><span>{e(f['kind'])}</span><span>{e(f['duration'])}</span></div><h3>{e(f['title'])}</h3><p>{e(f['description'])}</p><video controls playsinline preload="none" poster="media/{e(f['id'])}.jpg" aria-label="{e(f['title'])} project film" aria-describedby="film-note-{e(f['id'])}"><source src="media/{e(f['id'])}.mp4" type="video/mp4">Your browser does not support embedded video. <a href="media/{e(f['id'])}.mp4">Open the MP4</a>.</video><p class="film-note" id="film-note-{e(f['id'])}">{e(f['note'])}</p><div class="film-bottom"><details><summary>Video summary</summary><p>{e(f['summary'])}</p></details><a href="media/{e(f['id'])}.mp4" download>Download MP4 · {e(f['size'])}</a></div></article>'''
def game_feature(p):
    images=[('world-route','Six detailed planets connected by the frontier route on the game’s star map.','The journey','Six worlds give the arcade loop a sense of place.'),('helios-briefing','Helios, a red volcanic planet, beside its mission objective and route progress.','The arrival','A destination and an objective before the first shot.'),('sector-clear','Aurelia sector completion panel showing score, hull integrity and the approach to Khepri.','The payoff','A clear debrief connects victory to the next world.')]
    gallery=''.join(f'''<figure><a href="media/space-duel/{name}.webp" target="_blank" rel="noopener noreferrer" aria-label="Open full-size screenshot: {e(title)} (opens in a new tab)"><img src="media/space-duel/{name}.webp" width="1024" height="768" loading="lazy" decoding="async" alt="{e(alt)}"></a><figcaption><strong>{e(title)}</strong><span>{e(caption)}</span></figcaption></figure>''' for name,alt,title,caption in images)
    return f'''<article class="game-project" id="proj-{e(p['id'])}" aria-labelledby="space-duel-heading"><div class="game-feature-grid"><div class="game-copy"><p class="kind">{e(p['kind'])}</p><h4 id="space-duel-heading">{e(p['title'])}</h4><p class="game-tagline">One pilot. Six worlds.<br>A reason to keep flying.</p><p>{e(p['desc'])}</p><ul class="tags" aria-label="Game technologies and skills">{''.join('<li>'+e(t)+'</li>' for t in p['tags'])}</ul><div class="actions"><a class="button primary" href="{e(p['url'])}">{e(p['cta'])} <span aria-hidden="true">→</span></a></div><p class="game-role"><strong>My role</strong>Gameplay programming, interface design, visual direction and testing.</p></div><figure class="game-hero-image"><a href="media/space-duel/combat.webp" target="_blank" rel="noopener noreferrer" aria-label="Open full-size Space Ship Duel combat screenshot (opens in a new tab)"><img src="media/space-duel/combat.webp" width="1024" height="768" loading="lazy" decoding="async" alt="Space Ship Duel in play: a blue interceptor faces three enemy ships above Aurelia, with weapons, hull and sector progress in the HUD."></a><figcaption>Actual Pygame render · Aurelia orbital combat</figcaption></figure></div><div class="game-principles"><div><h5>Combat with clarity</h5><p>Staggered enemy arrivals, separated flight lanes, shields and readable weapon effects keep the action understandable.</p></div><div><h5>A connected player journey</h5><p>A cinematic prologue, mission briefings and five-wave sectors turn isolated fights into a journey across the frontier.</p></div><div><h5>Art that serves the game</h5><p>Distinct generated planets, darkened backdrops and cached visual effects give each world an identity while preserving combat contrast.</p></div></div><div class="game-gallery" aria-label="Space Ship Duel screenshot gallery">{gallery}</div><p class="game-art-note">Screenshots captured from the game. Planet and nebula artwork created with AI-assisted generation; gameplay effects and interfaces rendered in Pygame.</p></article>'''
cv='';in_list=False
for kind,text in rows:
    if kind in ['name','role','contact','links']: continue
    if kind!='bullet' and in_list: cv+='</ul>';in_list=False
    if kind=='section': cv+=f'<h3>{e(text)}</h3>'
    elif kind=='job': cv+=f'<h4>{e(text)}</h4>'
    elif kind=='bullet':
        if not in_list: cv+='<ul>';in_list=True
        cv+=f'<li>{e(text)}</li>'
    else: cv+=f'<p class="{kind}">{e(text)}</p>'
if in_list:cv+='</ul>'
intro_runtime=(ROOT/'intro.js').read_text()
intro_bootstrap="""(() => {
  let seen=false;try{seen=sessionStorage.getItem('joe_intro_seen_motion_v1')==='1';}catch{}
  window.__joeShowIntro=!location.hash&&!seen&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&performance.getEntriesByType('navigation')[0]?.type!=='back_forward';
  if(window.__joeShowIntro)document.documentElement.classList.add('intro-active');
})();"""
html='''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html.intro-active{overflow:hidden;background:#151d2e}.intro-active .site-header,.intro-active main,.intro-active .site-footer,.intro-active .skip,.intro-active #gaby-fab{visibility:hidden}</style><script>__INTRO_BOOTSTRAP__</script>
<title>Joe Sanjari — Python & AI Software Developer</title>
<meta name="description" content="Yousef (Joseph) Sanjari, Warsaw. Python development, AI and ML systems, practical problem solving and technical communication. Projects, experience and a general professional CV.">
<meta name="theme-color" content="#171e2e"><meta property="og:title" content="Joe Sanjari — Python & AI Software Developer"><meta property="og:description" content="Python development, AI systems and clear technical communication. Explore Joe’s work and general professional CV."><meta property="og:type" content="website"><meta property="og:url" content="https://josephsjr96.github.io/contact-card/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2317181f'/%3E%3Ctext x='32' y='44' text-anchor='middle' font-family='Arial' font-size='38' fill='%23c5b5ff'%3EJ%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="styles.css?v=20261107-motion"><script defer src="waves.js?v=20261107-motion"></script><script defer src="site-config.js?v=20261107-motion"></script><script defer src="app.js?v=20261107-motion"></script><script defer src="gaby.js?v=20261107-motion"></script>
</head><body>
<canvas id="wave-field" aria-hidden="true"></canvas>
<section id="boot" hidden aria-label="Welcome to Joe’s portfolio">
<div class="intro-topline"><p>JOE SANJARI <span>/</span> CREATIVE SYSTEMS</p><span class="intro-edition">FOUR DISCIPLINES. ONE MIND.</span></div>
<div class="discipline-stage" aria-hidden="true">
<figure class="discipline-card discipline-ai"><div class="discipline-card-top"><span>01 / INTELLIGENCE</span><span>✦</span></div><div class="discipline-visual"><img src="media/simon.jpg" width="960" height="540" alt="" decoding="async"><svg viewBox="0 0 100 100"><path d="M20 25 50 15 80 30 75 75 35 85 20 25 75 75 50 15 35 85 80 30 20 25M50 15 48 50 80 30M20 25 48 50 35 85M48 50 75 75"/><g><circle cx="20" cy="25" r="4"/><circle cx="50" cy="15" r="4"/><circle cx="80" cy="30" r="4"/><circle cx="75" cy="75" r="4"/><circle cx="35" cy="85" r="4"/><circle cx="48" cy="50" r="6"/></g></svg></div><figcaption><span>AI &amp; ML</span><small>Models · Inference · Evaluation</small></figcaption></figure>
<figure class="discipline-card discipline-game"><div class="discipline-card-top"><span>02 / PLAY</span><span>↗</span></div><div class="discipline-visual"><img src="media/space-duel/combat.webp" width="1024" height="768" alt="" decoding="async"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="25"/><ellipse cx="50" cy="50" rx="45" ry="13" transform="rotate(-25 50 50)"/><path d="m51 25 12 36-13-6-12 8Z"/></svg></div><figcaption><span>Game design</span><small>Systems · Worlds · Game feel</small></figcaption></figure>
<figure class="discipline-card discipline-code"><div class="discipline-card-top"><span>03 / BUILD</span><span>⌘</span></div><div class="discipline-visual"><img src="media/mlops.jpg" width="960" height="540" alt="" decoding="async"><svg viewBox="0 0 100 100"><path d="M32 25 8 50l24 25M68 25l24 25-24 25M61 15 39 85"/></svg></div><figcaption><span>Software</span><small>Python · APIs · Interfaces</small></figcaption></figure>
<figure class="discipline-card discipline-motion"><div class="discipline-card-top"><span>04 / EXPRESSION</span><span>▷</span></div><div class="discipline-visual"><img src="media/water-tank.jpg" width="960" height="540" alt="" decoding="async"><svg viewBox="0 0 100 100"><rect x="9" y="20" width="82" height="60" rx="3"/><path d="M9 33h82M9 67h82M23 20v13m18-13v13m18-13v13m18-13v13M23 67v13m18-13v13m18-13v13m18-13v13m-35-42 19 12-19 12Z"/></svg></div><figcaption><span>Visual stories</span><small>Motion · Diagrams · Communication</small></figcaption></figure>
</div>
<div class="intro-content"><p class="intro-kicker">CODE / INTELLIGENCE / WORLDS / MOTION</p><h2>Ideas into motion.</h2><p class="intro-detail">Different disciplines. Connected thinking.</p></div>
<div class="intro-bottom"><div class="intro-line" aria-hidden="true"></div><button id="intro-skip" type="button">Skip intro <span aria-hidden="true">→</span></button></div>
</section><script>__INTRO_RUNTIME__</script>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="container header-inner"><a class="brand" href="#contact"><span class="brand-mark" aria-hidden="true">JS /</span>Joe Sanjari</a><nav aria-label="Main navigation"><a href="#contact">Contact</a><a href="#work">Work</a><a href="#films">Films</a><a href="#cv">CV</a></nav></div></header>
<main id="main" class="container">
<section class="hero" id="contact" aria-labelledby="intro-heading"><div><p class="eyebrow">Python development · AI systems · Problem solving</p><h1 id="intro-heading">Complex problems.<br><span>Useful software.</span></h1><p class="intro">__PROFILE_INTRODUCTION__</p><div class="actions"><a class="button primary" href="#work">Explore my work <span aria-hidden="true">→</span></a><a class="button" href="cv.pdf" download="Yousef_Sanjari_CV.pdf">Download CV <span aria-hidden="true">↓</span></a></div></div><aside class="contact-card" aria-label="Contact Joe"><h2>Let's talk</h2><p>For roles, projects or a conversation.</p><a href="mailto:josephsanjari1996@gmail.com">Email Joe</a><a href="https://wa.me/48730504025?text=Hi%20Joe%2C%20I%20saw%20your%20portfolio." target="_blank" rel="noopener noreferrer">WhatsApp ↗</a><a href="https://linkedin.com/in/yousef-sanjari-712947207" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><a href="https://github.com/Josephsjr96" target="_blank" rel="noopener noreferrer">GitHub ↗</a><p class="location">Warsaw, Poland<br><a href="tel:+48730504025">+48 730 504 025</a></p></aside></section>
<section class="content-section" aria-labelledby="strengths-heading"><div class="section-head"><div><h2 id="strengths-heading">What I bring</h2><p>Three strengths that connect my work across software, AI and IT support.</p></div></div><div class="strength-grid">__STRENGTHS__</div></section>
<section class="content-section" id="work" aria-labelledby="work-heading"><div class="section-head"><div><h2 id="work-heading">Selected work</h2><p>Software development, AI systems and visual communication. Each project shows what I built, how I approached the problem and the scope of the results.</p></div></div><div class="project-grid">'''+''.join(card(p) for p in projects[:4])+'''</div><details class="more-projects"><summary>More projects</summary><div class="project-grid">'''+''.join(card(p) for p in projects[4:])+'''</div></details>'''+('<section class="game-design" id="game-design" aria-labelledby="game-design-heading"><div class="game-section-head"><div><p class="eyebrow">Interactive experiences</p><h3 id="game-design-heading">Game design</h3></div><p>Where systems, visual storytelling and player experience meet.</p></div>'+''.join(game_feature(p) for p in games)+'</section>' if games else '')+'''</section>
<section class="content-section" id="films" aria-labelledby="films-heading"><div class="section-head"><div><h2 id="films-heading">Project Films</h2><p>Short visual stories about the systems I build. Choose a film to play; sound starts only when you press play.</p></div></div><div class="film-grid">'''+''.join(film(f) for f in films)+'''</div></section>
<section class="content-section" id="cv" aria-labelledby="cv-heading"><div class="section-head"><div><h2 id="cv-heading">Curriculum vitae</h2><p>__PROFILE_TITLE__</p></div></div><div class="cv-layout"><aside class="cv-sidebar"><h3>Yousef (Joseph) Sanjari</h3><p>Python, AI systems and practical problem solving.<br>Warsaw, Poland</p><a class="button primary" id="cv-download" href="cv.pdf" download="Yousef_Sanjari_CV.pdf">Download CV <span aria-hidden="true">↓</span></a><small>PDF · One A4 page · Updated November 2026</small></aside><div class="cv-body"><h2 class="print-title" hidden>Yousef (Joseph) Sanjari</h2>'''+cv+'''</div></div></section>
</main><footer class="site-footer"><div class="container footer-inner"><span>Yousef (Joseph) Sanjari · Warsaw</span><div class="footer-links"><button id="replay-intro" type="button" hidden>Replay intro</button><button id="motion-toggle" type="button" aria-pressed="false" hidden>Pause waves</button><a href="mailto:josephsanjari1996@gmail.com">Email</a><a href="https://github.com/Josephsjr96" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a href="cv.pdf" download="Yousef_Sanjari_CV.pdf">Download CV</a></div></div></footer>
</body></html>'''
html=html.replace('__INTRO_BOOTSTRAP__',intro_bootstrap).replace('__INTRO_RUNTIME__',intro_runtime)
html=html.replace('__PROFILE_INTRODUCTION__',e(profile['introduction'])).replace('__PROFILE_TITLE__',e(profile['title']))
html=html.replace('__STRENGTHS__',''.join('<article class="strength"><h3>'+e(s['title'])+'</h3><p>'+e(s['text'])+'</p></article>' for s in profile['strengths']))
(ROOT/'index.html').write_text(html)
print_rows=[]
for kind,text in rows:
    tag='h1' if kind=='name' else 'h2' if kind=='section' else 'h3' if kind=='job' else 'p'
    content=e(text)
    if kind=='links':
        content='<a href="https://linkedin.com/in/yousef-sanjari-712947207">linkedin.com/in/yousef-sanjari-712947207</a> | <a href="https://github.com/Josephsjr96">github.com/Josephsjr96</a>'
    print_rows.append(f'<{tag} class="{kind}">{content}</{tag}>')
(ROOT/'cv.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yousef Sanjari — Python &amp; AI Software Developer</title><link rel="stylesheet" href="cv-print.css"></head><body><main>'+''.join(print_rows)+'</main></body></html>')
(ROOT/'cv.txt').write_text('\n\n'.join(('• ' if kind=='bullet' else '')+text for kind,text in rows)+'\n')
print('Built portfolio and CV source from cv-data.json. Regenerate cv.pdf after content changes.')
