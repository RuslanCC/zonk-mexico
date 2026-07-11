// Победная анимация конфетти на canvas — без сторонних библиотек.

const canvas = () => document.getElementById('confetti');
const COLORS = ['#6c5ce7', '#00cec9', '#ff6b6b', '#ffd166', '#51cf66', '#fd79a8', '#74b9ff'];

let running = false;

export function launchConfetti(duration = 2600) {
  const cv = canvas();
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const N = Math.min(180, Math.floor(innerWidth / 4));
  const parts = Array.from({ length: N }, () => ({
    x: Math.random() * innerWidth,
    y: -20 - Math.random() * innerHeight * 0.4,
    r: 5 + Math.random() * 7,
    c: COLORS[(Math.random() * COLORS.length) | 0],
    vy: 2 + Math.random() * 3.5,
    vx: -1.5 + Math.random() * 3,
    rot: Math.random() * Math.PI,
    vr: -0.15 + Math.random() * 0.3,
  }));

  const end = performance.now() + duration;
  running = true;

  function frame(now) {
    if (!running) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
      if (p.y > innerHeight + 30) { p.y = -20; p.x = Math.random() * innerWidth; }
    }
    if (now < end) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }
  requestAnimationFrame(frame);
}
