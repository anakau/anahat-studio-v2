// ── SPARKLE CURSOR TRAIL (ported from anahat.studio) ──
(function () {
  function spawnTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'cursor-trail-plus';

    const driftX = (Math.random() - 0.5) * 10;
    const driftY = 90;

    // Random scale for variation, from 0.7 to 1.3
    const scale = (Math.random() * 0.6) + 0.7;
    trail.style.transform = `translate(-50%, -50%) scale(${scale})`;

    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;

    trail.animate([
      {
        opacity: 1,
        transform: `translate(-50%, -50%) translateX(${driftX}px) translateY(0) scale(${scale})`
      },
      {
        opacity: 0,
        transform: `translate(-50%, -50%) translateX(${driftX}px) translateY(${driftY}px) scale(${scale})`
      }
    ], {
      duration: 2500,
      easing: 'ease-out',
      fill: 'forwards'
    });

    document.documentElement.appendChild(trail);

    setTimeout(() => trail.remove(), 2500);
  }

  document.addEventListener('mousemove', function (e) {
    spawnTrail(e.clientX, e.clientY);
  });

  // Touch devices don't fire mousemove during a drag (only a synthetic one
  // on tap) — touchmove is what actually fires continuously as a finger
  // moves, so the trail needs its own listener here to follow a drag.
  document.addEventListener('touchmove', function (e) {
    const touch = e.touches[0];
    if (!touch) return;
    spawnTrail(touch.clientX, touch.clientY);
  }, { passive: true });
})();
