/* Bench lighting is decorative and independent of assay state and thermal time. */
(() => {
  'use strict';
  const room = document.querySelector('.room-art');
  const lamp = document.querySelector('#dnaLamp');
  const power = document.querySelector('#lampPower');
  const task = document.querySelector('#taskLight');
  const svg = document.querySelector('#lampHelix');
  if (!room || !lamp || !power || !task || !svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true, lit = true, frame = 0, previous = 0, angle = 0;
  const segments = [];
  for (let i = 0; i < 33; i++) {
    const group = document.createElementNS(ns, 'g');
    const lines = Array.from({length: 3}, () => {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('stroke-linecap', 'round'); group.append(line); return line;
    });
    svg.append(group); segments.push({group, lines});
  }
  const point = (i, strand) => {
    const phase = i * Math.PI / 16 + angle + strand * Math.PI;
    const z = Math.cos(phase);
    return {x: 38 + Math.sin(phase) * 21, y: 10 + i * 3.8, z};
  };
  function draw() {
    segments.forEach(({group, lines}, i) => {
      const a = point(i, 0), b = point(i, 1);
      [[a, b], [a, point(i + 1, 0)], [b, point(i + 1, 1)]].forEach(([p, q], n) => {
        const line = lines[n];
        line.setAttribute('x1', p.x.toFixed(2)); line.setAttribute('y1', p.y.toFixed(2));
        line.setAttribute('x2', q.x.toFixed(2)); line.setAttribute('y2', q.y.toFixed(2));
        line.setAttribute('stroke', n === 0 ? '#d5d5b7' : n === 1 ? '#a5d9cf' : '#e2c89d');
        line.setAttribute('stroke-width', n === 0 ? '1.25' : '2.7');
        line.setAttribute('opacity', n === 0 ? '.58' : String(.62 + (p.z + 1) * .19));
      });
      // Order the bonds by depth so the lit sculpture reads as a volume.
      if (a.z < 0) group.insertBefore(lines[1], lines[0]);
      else group.append(lines[1]);
      if (b.z < 0) group.insertBefore(lines[2], lines[0]);
      else group.append(lines[2]);
    });
  }
  function tick(now) {
    if (previous) angle += Math.min(now - previous, 80) * Math.PI * 2 / 18000;
    previous = now; draw(); frame = requestAnimationFrame(tick);
  }
  function syncMotion() {
    cancelAnimationFrame(frame); previous = 0;
    if (enabled && !motion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function setPower() {
    lamp.classList.toggle('is-on', enabled); room.classList.toggle('lamp-on', enabled);
    power.setAttribute('aria-pressed', String(enabled));
    document.querySelector('#lampState').textContent = enabled ? 'ON' : 'OFF';
    syncMotion();
  }
  power.addEventListener('click', () => { enabled = !enabled; setPower(); });
  task.addEventListener('click', () => {
    lit = !lit; room.classList.toggle('night-mode', !lit);
    task.setAttribute('aria-pressed', String(lit));
    task.querySelector('span').textContent = lit ? 'Task light · on' : 'Task light · dim';
  });
  motion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  draw(); setPower();
})();
