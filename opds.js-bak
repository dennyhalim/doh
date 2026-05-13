// functions/opds.js
import readXlsxFile from 'read-excel-file';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sheet = url.searchParams.get('sheet');
  const category = url.searchParams.get('cat');
  const tag = url.searchParams.get('tag');
  const query = url.searchParams.get('q')?.trim() || '';
  const noCache = url.searchParams.get('nocache') === '1';

  const FEED_TITLE = env.FEED_TITLE || 'My Book Catalog';
  const FEED_AUTHOR = env.FEED_AUTHOR || 'Your Library';
  const BASE_URL = url.origin;
  const SCRIPT_PATH = url.pathname;
  const DATA_URL = env.DATA_URL || `https://docs.google.com/spreadsheets/d/e/2PACX-1vTTcNN6fmETWj5DDNC-FGSkdmD-8jCspO1dbMTweH4OjUM8ofBCuUR0NA7VfyLJG8ho-hPp6aT_AJbb/pub?output=xlsx`;

  // === GET & PARSE XLSX ===
  let sheets = {};
  try {
    const res = await fetch(DATA_URL, {
      cf: { cacheTtl: noCache? 0 : 300 }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const buffer = await res.arrayBuffer();
    // Baca semua sheet sekaligus
    sheets = await readXlsxFile(buffer, { getSheets: true });
  } catch (e) {
    return new Response(`Error: Cannot fetch/parse XLSX. ${e.message}`, { status: 500 });
  }

  // === PARSE ROWS PER SHEET ===
  const books = [];
  const opdsLinks = [];
  const allCategories = {};
  const allTags = {};

  const schema = {
    'id': { prop: 'id', type: String },
    'title': { prop: 'title', type: String },
    'author': { prop: 'author', type: String },
    'summary': { prop: 'summary', type: String },
    'cover_url': { prop: 'cover_url', type: String },
    'download_url': { prop: 'download_url', type: String },
    'language': { prop: 'language', type: String },
    'published': { prop: 'published', type: String },
    'category': { prop: 'category', type: String },
    'tags': { prop: 'tags', type: String },
    'opds_url': { prop: 'opds_url', type: String }
  };

  for (const sheetName of Object.keys(sheets)) {
    const buffer = await (await fetch(DATA_URL)).arrayBuffer();
    const { rows } = await readXlsxFile(buffer, { sheet: sheetName, schema });
    
    for (const item of rows) {
      if (!item.id &&!item.title) continue;
      
      item.tags = item.tags? String(item.tags).split(',').map(t => t.trim()).filter(Boolean) : [];
      item.opds_url = String(item.opds_url || '').trim();
      item.sheet = sheetName;

      if (item.opds_url) {
        item.category = '_OPDS_LINKS';
        opdsLinks.push(item);
      } else {
        item.category = String(item.category || sheetName || 'Uncategorized').trim();
        books.push(item);
        allCategories[item.category] = true;
        item.tags.forEach(t => allTags[t] = true);
      }
    }
  }

  // Filter + build OPDS XML sama kayak kode sebelumnya...
  // ...sisanya identik, ganti variabel aja
}
