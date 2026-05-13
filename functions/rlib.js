export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cat = url.searchParams.get('cat');
  const nocache = url.searchParams.has('nocache');

  
  const CONFIG = {
    title: 'Remote Library OPDS',
    id: 'urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    author: 'Your Library',
    allowed_ext: ['epub', 'pdf', 'mobi', 'pptx', 'ppsx'],
    max_depth: 1, // Pages Function max 30s, jangan dalam2
    cache_seconds: 36000,
    max_files: 2000,
  };

  // Daftar URL kamu. Edit di sini
  const REMOTE_FOLDERS = {
    'criswell': 'https://web.archive.org/web/20260512023217/http://wacriswell-indo.org/',
    'gits': 'https://web.archive.org/web/20260512030955/https://graphe-ministry.org/artikel-gratis/',
    'buktisaksi': 'https://web.archive.org/web/20191008055656/http://buktidansaksi.com/resources',
    'separation': 'https://web.archive.org/web/20260425122340/https://www.middletownbiblechurch.org/separate/separate.htm',
    'wayoflife': 'https://web.archive.org/web/20260414085034/https://www.wayoflife.org/free_ebooks/downloads/',
    'aig': 'https://archive.org/download/ken-ham-the-answers-book-for-kids-volume-7_202301',
    'hopetracts': 'https://web.archive.org/web/20260512081242/https://hopetracts.org/foreign/',
    'creation-tracts': 'https://web.archive.org/web/20260512074538/https://creation.com/en/pages/free-resources',
    'creation-science': 'https://web.archive.org/web/20260512074819/https://www.3bible.com/books.php',
    'ironside': 'https://archive.org/download/HarryIronsideBooks',
    'htaylor': 'https://archive.org/download/HudsonTaylorBooks',
    'tozer': 'https://archive.org/download/A.w.TozerKindleBooks',
    'lschafer': 'https://archive.org/download/LewisSperryChaferBooks',
    'rtorrey': 'https://archive.org/download/RobertTorreyBooks',
    'baptist-history': 'https://web.archive.org/web/20260512075817/https://nashpublications.com/baptist-church-history-books-for-class/',
    'calvinism': 'https://archive.org/download/AntiCALVINISTBooks',
  };

  const BASE_URL = `${url.protocol}//${url.host}${url.pathname}`;

  // === HELPERS ===
  const toDirectWayback = (u) => {
    if (!u.includes('web.archive.org/web/') || u.includes('/id_/')) return u;
    return u.replace(/(\/web\/\d{14})(?!id_)/i, '$1id_');
  };

  const getMime = (ext) => ({
    'epub': 'application/epub+zip',
    'pdf': 'application/pdf',
    'mobi': 'application/x-mobipocket-ebook'
  }[ext] || 'application/octet-stream');

  const safeText = (s) => s.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));

  const fetchTimeout = (url, ms = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OPDS-Bot/1.0', 'Connection': 'close' }
    }).finally(() => clearTimeout(id));
  };

  const scanUrl = async (targetUrl, depth = 0, found = [], visited = new Set()) => {
    if (depth > CONFIG.max_depth || found.length >= CONFIG.max_files || visited.has(targetUrl)) return found;
    visited.add(targetUrl);

    try {
      const res = await fetchTimeout(targetUrl);
      if (!res.ok) return found;
      const html = await res.text();
      const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);

      for (let link of hrefs) {
        if (link.startsWith('javascript:') || link.startsWith('#') || link.startsWith('mailto:')) continue;

        let full = link.match(/^https?:\/\//i)
         ? link
          : new URL(link, targetUrl).href;

        full = full.split('?')[0]; // buang query
        const ext = full.split('.').pop().toLowerCase();
        const isDir = link.endsWith('/');

        if (isDir &&!full.includes('web.archive.org')) {
          await scanUrl(full, depth + 1, found, visited);
        } else if (CONFIG.allowed_ext.includes(ext)) {
          found.push({
            url: toDirectWayback(full),
            name: decodeURIComponent(full.split('/').pop()),
            ext: ext,
            mtime: Date.now()
          });
        }
        if (found.length >= CONFIG.max_files) break;
      }
    } catch (e) {}
    return found;
  };

  const groupBooks = (books) => {
    const grouped = {};
    for (const b of books) {
      const base = b.name.replace(/\.[^.]+$/, '');
      const key = base.toLowerCase();
      if (!grouped[key]) grouped[key] = { title: base, mtime: b.mtime, formats: [] };
      if (!grouped[key].formats.find(f => f.url === b.url)) {
        grouped[key].formats.push({ url: b.url, ext: b.ext });
        if (b.mtime > grouped[key].mtime) grouped[key].mtime = b.mtime;
      }
    }
    return grouped;
  };

  const buildFeed = (id, title, kind, entries) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/" xmlns:opds="http://opds-spec.org/2010/catalog">
<id>${id}</id>
<title>${safeText(title)}</title>
<updated>${new Date().toISOString()}</updated>
<author><name>${CONFIG.author}</name></author>
<link href="${BASE_URL}" rel="start" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
<link href="${BASE_URL}${url.search}" rel="self" type="application/atom+xml;profile=opds-catalog;kind=${kind}"/>
${entries}
</feed>`;
    return xml;
  };

  const buildNav = () => {
    const entries = Object.keys(REMOTE_FOLDERS).map(cat => `
<entry>
  <title>${safeText(cat)}</title>
  <id>urn:uuid:cat-${crypto.randomUUID()}</id>
  <updated>${new Date().toISOString()}</updated>
  <content type="text">Category: ${safeText(cat)}</content>
  <link href="${BASE_URL}?cat=${encodeURIComponent(cat)}" rel="subsection" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
</entry>`).join('');
    return buildFeed(CONFIG.id, CONFIG.title, 'navigation', entries);
  };

  const buildAcquisition = (cat, books) => {
    const grouped = groupBooks(books);
    const entries = Object.entries(grouped).map(([key, book]) => {
      const formats = book.formats.map(f => `<link href="${safeText(f.url)}" rel="http://opds-spec.org/acquisition/open-access" type="${getMime(f.ext)}" title="${f.ext.toUpperCase()}"/>`).join('');
      return `
<entry>
  <title>${safeText(book.title)}</title>
  <id>urn:uuid:${crypto.randomUUID()}</id>
  <updated>${new Date(book.mtime).toISOString()}</updated>
  <dc:language>en</dc:language>
  <content type="text">Available: ${book.formats.map(f=>f.ext.toUpperCase()).join(', ')}</content>
  ${formats}
</entry>`;
    }).join('');
    return buildFeed(CONFIG.id+':'+cat, `${CONFIG.title} - ${cat}`, 'acquisition', entries);
  };

  // === MAIN ===
  try {
    const cacheKey = cat? `cat:${cat}` : 'nav';
    const cache = env.OPDS_CACHE; // KV binding

    if (!nocache) {
      const cached = await cache.get(cacheKey, 'json');
      if (cached && Date.now() - cached.ts < CONFIG.cache_seconds * 1000) {
        return new Response(cached.xml, {
          headers: {
            'Content-Type': 'application/atom+xml; charset=utf-8',
            'X-Cache': 'HIT'
          }
        });
      }
    }

    let xml, status = 'MISS';

    if (cat === null) {
      xml = buildNav();
    } else {
      if (!REMOTE_FOLDERS[cat]) return new Response('Category not found', { status: 404 });

      try {
        const books = await scanUrl(REMOTE_FOLDERS[cat]);
        if (!books.length) throw new Error('No books found');
        xml = buildAcquisition(cat, books);
      } catch (e) {
        // Fallback ke cache lama walau expired
        const stale = await cache.get(cacheKey, 'json');
        if (stale) {
          return new Response(stale.xml, {
            headers: {
              'Content-Type': 'application/atom+xml; charset=utf-8',
              'X-Cache': 'STALE',
              'X-Cache-Error': e.message
            }
          });
        }
        throw e;
      }
    }

    // Simpen ke KV. TTL 2 jam biar aman
    await cache.put(cacheKey, JSON.stringify({ ts: Date.now(), xml }), { expirationTtl: 7200 });

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'X-Cache': status
      }
    });

  } catch (e) {
    return new Response(`OPDS Error: ${e.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
