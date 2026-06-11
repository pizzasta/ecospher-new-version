/* Signal Observatory — ambient behaviors (vanilla JS, no deps) */
(() => {
  'use strict';

  const shell = document.getElementById('shell');
  const feed = document.getElementById('feed');

  /* ── sample layout: 22 cards ─────────────────────────────────── */
  const TITLES = [
    'still awake', 'replaying that moment', 'late drive', 'left on read',
    'quiet hours', 'background voices', 'the 3am signal', 'unsent draft',
    'half a song', 'wrong person', 'soft static', 'nobody answered',
    'long hallway', 'low battery', 'fan noise', 'parking lot',
    'almost called', 'midnight laundry', 'fading transmission',
    'recovered fragment', 'open frequency', 'last replay',
  ];
  const STATUS_PAIRS = [['drifting', 'holding'], ['fading', 'returning'], ['open', 'quiet']];

  TITLES.forEach((title, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    const pair = STATUS_PAIRS[i % STATUS_PAIRS.length];
    card.dataset.statusA = pair[0];
    card.dataset.statusB = pair[1];
    card.innerHTML =
      '<h2>' + title + '</h2>' +
      '<div class="meta">' +
        '<span class="stat-number" data-value="' + (12 + ((i * 7) % 80)) + '"></span>' +
        '<span class="status">' + pair[0] + '</span>' +
        '<span class="resonance">resonance <b>' + (40 + ((i * 13) % 55)) + '.0</b></span>' +
        '<span class="blurred-number" title="click to reveal">' + (100 + i * 3) + '</span>' +
      '</div>';
    feed.appendChild(card);
  });
  const cards = [...feed.querySelectorAll('.card')];

  /* 1 · active borders: fade between two low-sat colors every 30s */
  let borderFlip = false;
  setInterval(() => {
    borderFlip = !borderFlip;
    shell.style.setProperty('--border-now', borderFlip ? 'var(--border-b)' : 'var(--border-a)');
  }, 30000);

  /* 4 · time layers: opacity by viewport position (two observers) */
  const near = new Set();
  const inView = new Set();
  const applyLayer = (card) => {
    card.style.opacity = inView.has(card) ? '1' : near.has(card) ? '0.5' : '0.2';
  };
  const ioInView = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      e.isIntersecting ? inView.add(e.target) : inView.delete(e.target);
      applyLayer(e.target);
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  const ioNear = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      e.isIntersecting ? near.add(e.target) : near.delete(e.target);
      applyLayer(e.target);
    });
  }, { rootMargin: '240px 0px 240px 0px' });
  cards.forEach((c) => { ioInView.observe(c); ioNear.observe(c); });

  /* 2 · scroll traces: faint clone when a card scrolls out (max 5) */
  const traces = [];
  const lastRect = new Map();
  const ioTrace = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        lastRect.set(e.target, e.boundingClientRect);
        return;
      }
      const rect = lastRect.get(e.target);
      if (!rect) return;
      lastRect.delete(e.target);
      if (traces.length >= 5) {
        const oldest = traces.shift();
        oldest.remove();
      }
      const clone = e.target.cloneNode(true);
      clone.classList.add('trace');
      clone.style.left = rect.left + 'px';
      clone.style.top = (e.boundingClientRect.top < 0 ? 8 : window.innerHeight - 48) + 'px';
      clone.style.width = rect.width + 'px';
      document.body.appendChild(clone);
      traces.push(clone);
      requestAnimationFrame(() => clone.classList.add('fading'));
      setTimeout(() => {
        clone.remove();
        const i = traces.indexOf(clone);
        if (i !== -1) traces.splice(i, 1);
      }, 30500);
    });
  }, { threshold: 0 });
  cards.forEach((c) => ioTrace.observe(c));

  /* 3 · small random changes every 12–47s */
  const drift = () => {
    const card = cards[(Math.random() * cards.length) | 0];
    const roll = Math.random();
    if (roll < 0.34) {
      const b = card.querySelector('.resonance b');
      const next = parseFloat(b.textContent) + (Math.random() < 0.5 ? -0.3 : 0.3);
      b.textContent = next.toFixed(1);
    } else if (roll < 0.67) {
      const s = card.querySelector('.status');
      s.textContent = s.textContent === card.dataset.statusA ? card.dataset.statusB : card.dataset.statusA;
    } else {
      const cur = parseFloat(card.style.getPropertyValue('--grad-angle')) || 160;
      card.style.setProperty('--grad-angle', (cur + (Math.random() < 0.5 ? -1 : 1)) + 'deg');
    }
    setTimeout(drift, 12000 + Math.random() * 35000);
  };
  setTimeout(drift, 12000);

  /* 8 · room climate: phrases replace raw listener counts, rotate every 2min */
  const CLIMATE = ['light activity', 'quiet', 'building', 'hushed', 'still'];
  const stats = [...document.querySelectorAll('.stat-number')];
  let climateTick = 0;
  const setClimate = () => {
    stats.forEach((el, i) => { el.textContent = CLIMATE[(i + climateTick) % CLIMATE.length]; });
    climateTick++;
  };
  setClimate();
  setInterval(setClimate, 120000);

  /* 6 · blurred unknowns */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.blurred-number');
    if (!el) return;
    if (!el.classList.contains('revealed')) {
      el.classList.add('revealed');
    } else {
      el.classList.remove('revealed');
      // stays blurred again after the 5s grace window
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('revealed'), 5000);
    }
  });

  /* 5 · inactivity: faint dots after 30s, pulse shell on return */
  const dots = document.getElementById('idle-dots');
  let idleTimer = null;
  let idle = false;
  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idle = true; dots.classList.add('on'); }, 30000);
  };
  const wake = () => {
    if (idle) {
      idle = false;
      dots.classList.remove('on');
      shell.classList.add('pulse');
      setTimeout(() => shell.classList.remove('pulse'), 200);
    }
    armIdle();
  };
  ['click', 'scroll', 'keydown'].forEach((ev) => addEventListener(ev, wake, { passive: true }));
  armIdle();

  /* 7 · navigation trail: dotted circle follows cursor for 1s after a click */
  const trail = document.getElementById('trail');
  let trailing = false;
  const moveTrail = (e) => {
    trail.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('a, button, .blurred-number')) return;
    if (trailing) return;
    trailing = true;
    moveTrail(e);
    trail.classList.add('on');
    document.addEventListener('mousemove', moveTrail);
    setTimeout(() => {
      trail.classList.remove('on');
      document.removeEventListener('mousemove', moveTrail);
      trailing = false;
    }, 1000);
  });
})();
