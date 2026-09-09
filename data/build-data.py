import json, re

raw = json.load(open('scraped_projects.json'))
about = json.load(open('scraped_about.json'))

NAV_RE = re.compile(r'^.*?Misc\s*\n', re.S)
FOOTER_RE = re.compile(r'©\s*2025 Anahat Kaur.*$', re.S)
YEAR_RE = re.compile(r'^\s*(20\d{2})\s*$', re.M)
# Strip decorative glyphs: Cargo's private-use-area link-arrow icons,
# variation selectors, and zero-width joiners that leak into scraped text.
ICON_RE = re.compile('[' + chr(0xE000) + '-' + chr(0xF8FF) + chr(0xFE00) + '-' + chr(0xFE0F) + chr(0x200D) + chr(0x25B8) + chr(0x25B6) + ']')

def clean(text, project_name):
    if not text:
        return {'paragraphs': [], 'year': None, 'externalLink': None}
    t = NAV_RE.sub('', text)
    t = FOOTER_RE.sub('', t)
    t = ICON_RE.sub('', t)
    t = t.strip()

    external_link = None
    link_match = re.search(r'^([a-zA-Z0-9.\-]+\.[a-z]{2,})\s*$', t, re.M)
    if link_match and '.' in link_match.group(1):
        external_link = link_match.group(1)
        t = t[:link_match.start()] + t[link_match.end():]
        t = t.strip()

    year_match = YEAR_RE.search(t)
    year = year_match.group(1) if year_match else None
    if year_match:
        t = t[:year_match.start()] + t[year_match.end():]

    # Drop short standalone lines that look like role/client labels repeated
    # from the ledger (keep only real paragraphs, not stray short fragments)
    parts = [p.strip() for p in re.split(r'\n\s*\n', t) if p.strip()]
    paragraphs = [p for p in parts if len(p) > 40]
    return {'paragraphs': paragraphs, 'year': year, 'externalLink': external_link}

projects = []
for p in raw:
    info = clean(p.get('text'), p['name'])
    projects.append({
        'name': p['name'],
        'category': p['category'],
        'url': p['url'],
        'external': p.get('external', False),
        'cover': p.get('cover'),
        'images': p.get('images', []),
        'year': info['year'],
        'externalLink': info['externalLink'],
        'paragraphs': info['paragraphs'],
    })

with open('projects.json', 'w') as f:
    json.dump(projects, f, indent=2, ensure_ascii=False)

for p in projects:
    print(f"{p['name']:28s} year={p['year']} imgs={len(p['images']):3d} paras={len(p['paragraphs'])} link={p['externalLink']}")
