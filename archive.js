// ── ARCHIVE ──
// A plain, uniform list of every project in PROJECTS (data.js) — no huge
// titles, no overlapping cards, no expand/reveal. Practice will hold the
// curated, fully-designed pages as they're built; this is just the
// complete record in the meantime.

function byYearDesc(p1, p2) {
  const y1 = p1.year ? parseInt(p1.year, 10) : -Infinity;
  const y2 = p2.year ? parseInt(p2.year, 10) : -Infinity;
  return y2 - y1;
}

function renderArchive() {
  const el = document.getElementById('archive-list');
  if (!el || typeof PROJECTS === 'undefined') return;

  const sorted = PROJECTS.slice().sort(byYearDesc);

  el.innerHTML = sorted.map(p => {
    const linkHref = p.external ? p.url : (p.externalLink ? `https://${p.externalLink}` : null);
    const nameContent = linkHref
      ? `<a href="${linkHref}" target="_blank" rel="noopener">${p.name} ↗</a>`
      : p.name;
    const tags = (p.tags || []).join(' · ');

    return `
      <div class="archive-row">
        <span class="archive-name">${nameContent}</span>
        <span class="archive-year">${p.year || ''}</span>
        <span class="archive-category">${p.category || ''}</span>
        <span class="archive-tags">${tags}</span>
      </div>
    `;
  }).join('');
}

renderArchive();
