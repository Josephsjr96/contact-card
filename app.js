(() => {
  const links = [...document.querySelectorAll('nav a')];
  const sections = ['contact', 'work', 'cv'].map(id => document.getElementById(id));
  function activate(id) {
    links.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function fromHash() {
    const id = location.hash.slice(1);
    activate(sections.some(section => section.id === id) ? id : 'contact');
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  let pending = false;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      const current = sections.filter(section => section.getBoundingClientRect().top <= 150).at(-1);
      if (current) activate(current.id);
      pending = false;
    });
  }, {passive:true});
  window.PORTFOLIO = {
    samples: window.SITE.samples,
    show(id) {
      const section = sections.find(section => section.id === id);
      if (!section) return;
      location.hash = id;
      section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    },
    open(id) {
      const sample = window.SITE.samples.find(sample => sample.id === id);
      if (!sample) return;
      if (sample.external) window.open(sample.url, '_blank', 'noopener,noreferrer');
      else location.assign(sample.url);
    }
  };
})();
