// ── SPARKLE CURSOR TRAIL (ported from anahat.studio) ──
(function () {
  document.addEventListener('mousemove', function (e) {
    const trail = document.createElement('div');
    trail.className = 'cursor-trail-plus';

    const x = e.clientX;
    const y = e.clientY;
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
  });
})();
