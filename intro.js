/* A short visual welcome. Content and deep links never depend on it. */
(() => {
  const intro = document.getElementById('boot');
  const skip = document.getElementById('intro-skip');
  if (!intro || !skip) return;
  if (!window.__joeShowIntro) return;
  try { sessionStorage.setItem('joe_intro_seen', '1'); } catch {}
  intro.hidden = false;
  document.documentElement.classList.add('intro-active');
  let closed = false;
  const content = () => document.querySelectorAll('.site-header, main, .site-footer');
  const lockContent = () => { if (!closed) content().forEach(el => el.inert = true); };
  lockContent();
  document.addEventListener('DOMContentLoaded', lockContent, {once:true});
  function dismiss() {
    if (closed) return;
    closed = true;
    const hadFocus = intro.contains(document.activeElement);
    intro.hidden = true;
    document.documentElement.classList.remove('intro-active');
    content().forEach(el => el.inert = false);
    if (hadFocus) document.querySelector('.brand')?.focus({preventScroll:true});
    document.removeEventListener('keydown', onKey);
  }
  function onKey(event) { if (event.key === 'Escape') dismiss(); }
  skip.onclick = dismiss;
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', dismiss, {once:true});
  setTimeout(dismiss, 3500);
})();
