(() => {
  const body = document.body;
  const intro = document.getElementById('intro');
  const word = document.getElementById('introWord');
  const dot = intro.querySelector('.intro-dot');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  document.getElementById('year').textContent = new Date().getFullYear();

  // ---------- Halftone portrait ----------
  const canvas = document.getElementById('halftone');
  const src = document.getElementById('portraitSrc');

  function drawHalftone(progress = 1) {
    const size = canvas.clientWidth;
    if (!size || !src.naturalWidth) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cells = size < 500 ? 70 : 96;
    const off = document.createElement('canvas');
    off.width = off.height = cells;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(src, 0, 0, cells, cells);
    const px = octx.getImageData(0, 0, cells, cells).data;

    // Soft head-and-shoulders mask tuned to assets/kaiwalya.png, so the wall behind drops out
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const subject = (u, v) => {
      const head = 1 - Math.hypot((u - 0.47) / 0.21, (v - 0.36) / 0.33);
      const torso = v > 0.58 ? Math.min((u - 0.27 + (v - 0.58) * 0.5) / 0.06, (0.9 - u) / 0.06) : -1;
      return clamp01(Math.max(head / 0.12, torso));
    };

    const step = size / cells;
    const c = cells / 2;
    ctx.clearRect(0, 0, size, size);
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const i = (y * cells + x) * 4;
        const s = subject((x + 0.5) / cells, (y + 0.5) / cells);
        let lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
        lum = Math.pow(lum, 0.75) * s + 0.04 * (1 - s); // lift mid-tones so the face reads
        // Radial falloff hides the square photo edge (and its corner icon)
        const d = Math.hypot(x - c, y - c) / c;
        const fade = Math.max(0, Math.min(1, (0.86 - d) / 0.3));
        // Reveal from the centre outwards
        const reveal = Math.max(0, Math.min(1, (progress * 1.3 - d) / 0.3));
        const r = (step / 2) * lum * fade * reveal * 1.05;
        if (r < 0.25) continue;
        ctx.fillStyle = `rgba(235,235,235,${0.35 + 0.65 * lum})`;
        ctx.beginPath();
        ctx.arc(x * step + step / 2, y * step + step / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function revealHalftone() {
    canvas.classList.add('show');
    if (reduced) return drawHalftone(1);
    const start = performance.now();
    const dur = 1600;
    (function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      drawHalftone(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  const imgReady = src.complete ? Promise.resolve() : new Promise(r => { src.onload = r; src.onerror = r; });
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => drawHalftone(1), 150); });

  // ---------- Intro sequence ----------
  function setWord(text) {
    word.innerHTML = '';
    return [...text].map(ch => {
      const s = document.createElement('span');
      s.textContent = ch;
      word.appendChild(s);
      return s;
    });
  }

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    intro.classList.add('done');
    body.classList.remove('is-intro');
    imgReady.then(revealHalftone);
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
  }

  async function playIntro() {
    // 1. Dot drops in and bounces
    await dot.animate([
      { opacity: 0, transform: 'translateY(-45vh) scaleY(1.6)' },
      { opacity: 1, transform: 'translateY(0) scale(1.3, .7)', offset: .55 },
      { opacity: 1, transform: 'translateY(-60px) scale(.9, 1.15)', offset: .78 },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 900, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' }).finished;
    if (finished) return;

    // 2. Chrome letters tumble in from random 3D positions
    const letters = setWord('KAIWALYA');
    dot.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(3)' }],
      { duration: 400, fill: 'forwards' });
    await Promise.all(letters.map((s, i) => s.animate([
      { opacity: 0, transform: `translate3d(${rand(-260, 260)}px, ${rand(-220, 220)}px, ${rand(-500, 200)}px) rotateX(${rand(-200, 200)}deg) rotateY(${rand(-160, 160)}deg) rotateZ(${rand(-90, 90)}deg)` },
      { opacity: 1, offset: .35 },
      { opacity: 1, transform: 'none' }
    ], { duration: 1000, delay: i * 55, easing: 'cubic-bezier(.2,.9,.25,1.05)', fill: 'forwards' }).finished));
    if (finished) return;
    await wait(350);

    // 3. Flip out, flip in as PORTFOLIO
    await Promise.all(letters.map((s, i) => s.animate([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'rotateX(90deg) translateY(-20px)' }
    ], { duration: 260, delay: i * 30, easing: 'ease-in', fill: 'forwards' }).finished));
    if (finished) return;
    const final = setWord('PORTFOLIO');
    await Promise.all(final.map((s, i) => s.animate([
      { opacity: 0, transform: 'rotateX(-90deg) translateY(30px)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 420, delay: i * 40, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' }).finished));
    if (finished) return;
    await wait(450);
    finish();
  }

  let seen = false;
  try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}
  intro.querySelector('.intro-skip').addEventListener('click', finish);
  if (reduced || seen || location.hash) {
    intro.style.transition = 'none';
    finish();
  } else {
    playIntro().catch(finish);
    setTimeout(finish, 7000); // safety net
  }

  // ---------- Nav ----------
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', e => {
    if (e.target.tagName === 'A') { links.classList.remove('open'); toggle.setAttribute('aria-expanded', false); }
  });
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight the current section in the nav
  const navMap = new Map([...links.querySelectorAll('a')].map(a => [a.getAttribute('href'), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const a = navMap.get('#' + en.target.id) || (en.target.id === 'top' ? navMap.get('#top') : null);
      if (a) { navMap.forEach(x => x.classList.remove('active')); a.classList.add('active'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['about', 'services', 'work', 'contact'].forEach(id => spy.observe(document.getElementById(id)));
  spy.observe(document.querySelector('.hero')); // hero has no id; map it to Home
  document.querySelector('.hero').id = 'home';
  navMap.set('#home', navMap.get('#top'));

  // ---------- Scroll reveal ----------
  const revealEls = document.querySelectorAll('.section h2, .big, .about-meta, .service, .skills li, .work-item, .steps li, .form, .contact-title, .lead');
  revealEls.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));
})();
