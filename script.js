// ── LEDGER ──

// Earlier, lower-priority work — collapsed under "Archive" until clicked open.
// Empty for now: the current roster is a hand-ordered sequence (see PROJECTS in
// data.js) and none of it is designated archived.
const ARCHIVE_SLUGS = new Set([]);

// Newest first; undated projects sort to the end, keeping their relative order.
function byYearDesc(a, b) {
  const ay = a.year ? parseInt(a.year, 10) : -Infinity;
  const by = b.year ? parseInt(b.year, 10) : -Infinity;
  return by - ay;
}

const ALL_VISIBLE = PROJECTS.filter(p => !ARCHIVE_SLUGS.has(p.slug)).sort(byYearDesc);
const ALL_ARCHIVED = PROJECTS.filter(p => ARCHIVE_SLUGS.has(p.slug)).sort(byYearDesc);

// ── FILTERS ──
// Themes (rounded pills) are conceptual threads; Mediums (square pills) are disciplines/tools.
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const THEMES = [
  'Systems Change', 'Governance', 'Culture', 'Diaspora',
  'More-Than-Human', 'Alt-Output', 'Planetary', 'Fashion Capsule Collection', 'Food', 'Master Thesis',
  'Consumer Goods', 'Civic Infrastructure', 'Museum Catalog', 'Timekeeping Application',
  'Circular Economy', 'Sustainability', 'Craft Revival', 'Voice Control Banking Application',
  'Economic Report', 'Knowledge Platform',
];
const MEDIUMS = [
  'Information', 'Art Direction', 'Vibe Code', 'Publication', 'Product', 'Motion',
  'UX/UI', 'Brand Identity', 'Packaging', 'Mix-Media', 'Processing', 'Experiments',
];

// Some themes/mediums show as tag text in the ledger but don't get their own
// filter pill — too narrow/one-off to be worth a button.
const NO_FILTER_PILL = new Set(['Master Thesis', 'Consumer Goods', 'Fashion Capsule Collection', 'Food', 'Application', 'Processing', 'Experiments']);

// Round theme pills are hidden for now (may bring them back later) — square
// medium pills still show. Flip this to true to restore them.
const SHOW_THEME_PILLS = false;

// Mix square (medium) and round (theme) pills together across two rows, instead of
// keeping each shape in its own row. "All" is pinned first, not shuffled.
const ALL_PILL = { label: 'All', theme: null, variant: 'all' };
const SHUFFLED_FILTERS = shuffle([
  ...(SHOW_THEME_PILLS ? THEMES.filter(t => !NO_FILTER_PILL.has(t)).map(t => ({ label: t, theme: t, variant: null })) : []),
  ...MEDIUMS.filter(m => !NO_FILTER_PILL.has(m)).map(m => ({ label: m, theme: m, variant: 'square' })),
]);
const FILTER_ROW_A = [ALL_PILL, ...SHUFFLED_FILTERS.slice(0, Math.ceil(SHUFFLED_FILTERS.length / 2))];
const FILTER_ROW_B = SHUFFLED_FILTERS.slice(Math.ceil(SHUFFLED_FILTERS.length / 2));

let activeTheme = null;

function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;

  function makePill(label, theme, variant) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-pill'
      + (variant ? ' filter-pill--' + variant : '')
      + (activeTheme === theme ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      activeTheme = activeTheme === theme ? null : theme;
      renderFilterBar();
      renderLedger();
    });
    return btn;
  }

  bar.innerHTML = '';

  const rowA = document.createElement('div');
  rowA.className = 'filter-row';
  FILTER_ROW_A.forEach(f => rowA.appendChild(makePill(f.label, f.theme, f.variant)));
  bar.appendChild(rowA);

  const rowB = document.createElement('div');
  rowB.className = 'filter-row';
  FILTER_ROW_B.forEach(f => rowB.appendChild(makePill(f.label, f.theme, f.variant)));
  bar.appendChild(rowB);
}

function matchesFilter(p) {
  return !activeTheme || (p.tags && p.tags.includes(activeTheme));
}

// Big overlapping cards: huge title on the left, small meta (year/theme/mediums)
// on the right. Cards stack with a negative margin + rising z-index so each one
// slides slightly in front of the one before it. Click reveals a thumbnail,
// description, tools, and links below the title; click again to close.
function buildCard(p, num) {
  const card = document.createElement('div');
  card.className = 'project-card';
  card.style.zIndex = num;

  const thumbSrc = p.cover || (p.images && p.images[0]) || '';
  const description = (p.paragraphs && p.paragraphs[0]) || '';
  const tools = p.tools || '';
  const linkHref = p.external ? p.url : (p.externalLink ? `https://${p.externalLink}` : null);

  // Round (theme) tags vs square (medium) tags — split by which list each
  // tag belongs to, not lumped together.
  const themeTags = (p.tags || []).filter(t => THEMES.includes(t));
  const mediumTags = (p.tags || []).filter(t => MEDIUMS.includes(t));

  card.innerHTML = `
    <div class="card-main">
      <div class="card-title-wrap">
        <span class="card-num">${String(num).padStart(2, '0')}</span>
        <h2 class="card-title">${p.name}${p.favorite ? ' <span class="card-favorite">★</span>' : ''}</h2>
      </div>
      <div class="card-meta">
        ${p.year ? `<span class="card-year">${p.year}</span>` : ''}
        ${(themeTags.length || mediumTags.length) ? `<span class="card-keywords">${[...themeTags, ...mediumTags].join(' · ')}</span>` : ''}
      </div>
    </div>
    ${thumbSrc ? `<img class="card-thumb" src="${thumbSrc}" alt="${p.name}">` : ''}
    <div class="card-reveal">
      ${description ? `<p class="card-desc">${description}</p>` : ''}
      ${tools ? `<p class="card-tools">${tools}</p>` : ''}
      <div class="card-links">
        ${linkHref ? `<a href="${linkHref}" target="_blank" rel="noopener">Visit ${p.name} ↗</a>` : ''}
        ${p.hasFullDocs ? `<a href="project.html?slug=${p.slug}">View Full Project →</a>` : ''}
      </div>
    </div>
  `;

  function closeCard(c) {
    c.classList.remove('expanded');
    c.style.zIndex = c.dataset.zBase || c.style.zIndex;
  }

  card.dataset.zBase = num;

  card.addEventListener('click', () => {
    const isOpen = card.classList.contains('expanded');
    document.querySelectorAll('.project-card.expanded').forEach(closeCard);
    if (!isOpen) {
      card.classList.add('expanded');
      card.style.zIndex = 999; // lift above overlapping cards below it while open
    }
  });

  return card;
}

function renderLedger() {
  const el = document.getElementById('ledger');
  if (!el) return;
  el.innerHTML = '';

  const visible = ALL_VISIBLE.filter(matchesFilter);
  const archived = ALL_ARCHIVED.filter(matchesFilter);

  if (!visible.length && !archived.length) {
    el.innerHTML = `<div class="ledger-empty">No projects tagged “${activeTheme}” yet.</div>`;
    return;
  }

  const VISIBLE_LIMIT = 10;
  const shown = visible.slice(0, VISIBLE_LIMIT);
  const hiddenVisible = visible.slice(VISIBLE_LIMIT);

  shown.forEach((p, i) => el.appendChild(buildCard(p, i + 1)));

  if (hiddenVisible.length) {
    const hiddenWrap = document.createElement('div');
    hiddenWrap.className = 'ledger-hidden';
    hiddenVisible.forEach((p, i) => hiddenWrap.appendChild(buildCard(p, VISIBLE_LIMIT + i + 1)));
    el.appendChild(hiddenWrap);

    // Placed after the hidden section (not between shown/hidden), so it always
    // trails whatever's currently visible — "View All" under the first 10,
    // "View Less" at the very bottom once expanded, never stuck mid-list.
    const viewAllToggle = document.createElement('div');
    viewAllToggle.className = 'project-card toggle-card';
    viewAllToggle.style.zIndex = shown.length + hiddenVisible.length + 1;
    viewAllToggle.innerHTML = `
      <div class="card-main">
        <div class="card-title-wrap"><h2 class="card-title">View All</h2></div>
        <div class="card-meta"><span class="toggle-chevron">+</span></div>
      </div>
    `;
    el.appendChild(viewAllToggle);

    viewAllToggle.addEventListener('click', () => {
      const open = hiddenWrap.classList.toggle('open');
      viewAllToggle.querySelector('.toggle-chevron').textContent = open ? '–' : '+';
      viewAllToggle.querySelector('.card-title').textContent = open ? 'View Less' : 'View All';
      if (open) {
        // Wait for the reveal transition to finish so we scroll to its settled position.
        setTimeout(() => {
          hiddenWrap.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 500);
      }
    });
  }

  if (archived.length) {
    const archiveToggle = document.createElement('div');
    archiveToggle.className = 'project-card toggle-card';
    archiveToggle.innerHTML = `
      <div class="card-main">
        <div class="card-title-wrap"><h2 class="card-title">Archive</h2></div>
        <div class="card-meta">
          <span class="card-year">${archived.length} earlier project${archived.length === 1 ? '' : 's'}</span>
          <span class="toggle-chevron">+</span>
        </div>
      </div>
    `;
    el.appendChild(archiveToggle);

    const archiveWrap = document.createElement('div');
    archiveWrap.className = 'ledger-archive';
    archived.forEach((p, i) => archiveWrap.appendChild(buildCard(p, visible.length + i + 1)));
    el.appendChild(archiveWrap);

    archiveToggle.addEventListener('click', () => {
      const open = archiveWrap.classList.toggle('open');
      archiveToggle.querySelector('.toggle-chevron').textContent = open ? '–' : '+';
    });
  }
}

renderFilterBar();
renderLedger();

// ── PROJECT WHEEL (homepage) ──
// A decoder-wheel graphic (images/decoding wheel.svg) sits on top of a rotating
// "disc" layer. The disc holds the thumbnail (full-bleed) and the project name;
// the frame's square window reveals the thumbnail, its wide window reveals the
// name, and everything else about the frame is opaque. Year sits just above the
// square window, theme/medium keywords just below it — both painted directly
// onto the frame's solid blue, so they use the frame's yellow rather than the
// page's ink color.
(function initWheel() {
  const wheel = document.getElementById('project-wheel');
  if (!wheel) return;

  const thumbEl = document.getElementById('wheel-thumb');
  const nameEl = document.getElementById('wheel-name');
  const yearEl = document.getElementById('wheel-year');
  const keywordsEl = document.getElementById('wheel-keywords');
  const discEl = document.getElementById('wheel-disc-content');
  const prevBtn = wheel.querySelector('.wheel-btn--prev');
  const nextBtn = wheel.querySelector('.wheel-btn--next');

  const pool = PROJECTS
    .filter(p => p.cover || (p.images && p.images.length))
    .sort(byYearDesc)
    .slice(0, 10);
  if (!pool.length) return;

  let index = 0;

  function render() {
    const p = pool[index];
    thumbEl.src = p.cover || p.images[0];
    thumbEl.alt = p.name;
    nameEl.textContent = p.name;
    yearEl.textContent = p.year || '';
    const themeTags = (p.tags || []).filter(t => THEMES.includes(t));
    const mediumTags = (p.tags || []).filter(t => MEDIUMS.includes(t));
    keywordsEl.textContent = [...themeTags, ...mediumTags].join(' · ');
  }

  function turn(dir) {
    discEl.style.transform = `rotate(${dir * 25}deg) scale(0.96)`;
    setTimeout(() => {
      index = (index + dir + pool.length) % pool.length;
      render();
      discEl.style.transform = 'rotate(0deg) scale(1)';
    }, 200);
  }

  prevBtn.addEventListener('click', () => turn(-1));
  nextBtn.addEventListener('click', () => turn(1));

  render();
})();
