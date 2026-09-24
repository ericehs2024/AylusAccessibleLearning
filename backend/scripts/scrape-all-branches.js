/**
 * Scrape all AYLUS branches and populate local dev DB (branches table).
 * Uses branch name as default username + password (slugified).
 * 
 * Usage:
 *   # from backend folder:
 *   node scripts/scrape-all-branches.js            # scrape + upsert into DB from .env.local (aylus_local)
 *   node scripts/scrape-all-branches.js --dry      # preview without writing
 *   node scripts/scrape-all-branches.js --reset    # truncate branches table first (DANGER)
 *
 * Then export local DB to Hostinger prod:
 *   mysqldump -u root -p aylus_local > dump.sql
 *   # via Hostinger hPanel -> phpMyAdmin -> u133287421_learning -> Import -> dump.sql
 *   # or via CLI: mysql -h mysql.hostinger.com -u u133287421_acclearn -p u133287421_learning < dump.sql
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();
const localEnv = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(localEnv)) require('dotenv').config({ path: localEnv, override: true });

const axios = require('axios');
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');
const db = require('../db');

const DRY = process.argv.includes('--dry');
const RESET = process.argv.includes('--reset');

function slugify(name) {
  return String(name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 64) || ('branch-' + Date.now());
}

async function fetchBranchNames() {
  // 1) Priority: scrape https://aylus.org/branches-2/ under "In chronological order", exclude Princeton Closed
  for (const url of ['https://aylus.org/branches-2/']) {
    try {
      console.log(`[scrape] Trying HTML chronological ${url}`);
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120', 'Accept': 'text/html' },
        timeout: 15000, validateStatus: () => true
      });
      if (res.status !== 200 || !res.data) continue;
      const $ = cheerio.load(res.data);
      // Find "In chronological order" heading, then extract links in order from its table
      const chronoHeader = $('h2').filter((_, el) => $(el).text().toLowerCase().includes('in chronological order')).first();
      let names = [];
      if (chronoHeader.length) {
        const chronoTable = chronoHeader.closest('table');
        // the chronological list is inside this table's <ul><li><a>
        chronoTable.find('a').each((_, el) => {
          const t = $(el).text().trim().replace(/\s+/g, ' ');
          const href = $(el).attr('href') || '';
          if (!t || t.length > 80 || t.length < 3) return;
          if (!href.includes('aylus.org')) return;
          // Exclude Princeton (Closed, click for details) per request
          if (/Princeton/i.test(t) && /Closed/i.test(t)) return;
          if (/^(Home|About|Programs|FAQ|Support|Branches|Banner)/i.test(t)) return;
          // keep in DOM order (chronological)
          if (!names.includes(t)) names.push(t);
        });
        console.log(`[scrape] Chronological table found ${names.length} branches`);
        if (names.length >= 20) return names;
      }
      // Fallback: if chronological header not found, try generic table a
      console.log('[scrape] Chronological header not found or too few, falling back to generic table');
      const fallback = new Set();
      $('table a').each((_, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ');
        const href = $(el).attr('href') || '';
        if (t && t.length < 80 && t.length > 3 && href.includes('aylus.org')) {
          if (/^(Home|About|Programs|FAQ|Support|Branches|Banner)/i.test(t)) return;
          if (/Princeton/i.test(t) && /Closed/i.test(t)) return;
          fallback.add(t);
        }
      });
      const list = [...fallback].filter(n => !/^(Next|Previous|Read more)/i.test(n));
      if (list.length >= 20) {
        console.log(`[scrape] Fallback HTML table ${url} found ${list.length} branches`);
        return list;
      }
    } catch (e) { console.warn(`[scrape] HTML chronological ${e.message}`); }
  }

  // 2) Fallback: WP JSON category 513, but filter to only true branch pages (short titles like "Lake Washington, WA")
  try {
    console.log('[scrape] Trying WP JSON categories (filtered)...');
    const catRes = await axios.get('https://aylus.org/wp-json/wp/v2/categories', { params: { search: 'a-branch', per_page: 10 }, timeout: 15000 });
    const cat = (catRes.data || []).find(c => String(c.slug).toLowerCase().includes('branch')) || catRes.data[0];
    if (cat && cat.id) {
      console.log(`[scrape] Category "${cat.name}" id=${cat.id}`);
      const branchNames = [];
      let page = 1;
      while (page <= 5) {
        const url = `https://aylus.org/wp-json/wp/v2/posts?categories=${cat.id}&per_page=100&page=${page}`;
        console.log(`[scrape] Fetching ${url}`);
        const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
        if (res.status !== 200 || !Array.isArray(res.data) || res.data.length === 0) break;
        for (const p of res.data) {
          const raw = (p.title && p.title.rendered) ? p.title.rendered.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : '';
          if (!raw) continue;
          // branch pages are short like "Auburn (AL)" or "Greater Triangle, NC" — filter out long activity titles
          if (raw.length > 60) continue;
          if (/Volunteers at|Volunteered at|Hosts a|Camp|Award|Meeting|Gala/i.test(raw)) continue;
          branchNames.push(raw);
        }
        if (res.data.length < 100) break;
        page++;
      }
      if (branchNames.length >= 20) {
        console.log(`[scrape] WP JSON filtered found ${branchNames.length} branches`);
        return branchNames;
      }
    }
  } catch (e) { console.warn('[scrape] WP JSON failed:', e.message); }

  throw new Error('Could not fetch branch list from aylus.org');
}

async function main() {
  const rawNames = await fetchBranchNames();
  // dedupe and clean
  const seen = new Set();
  const branchNames = [];
  for (const n of rawNames) {
    const clean = String(n).replace(/\s+/g, ' ').trim();
    const slug = slugify(clean);
    if (!clean || seen.has(slug)) continue;
    seen.add(slug);
    branchNames.push(clean);
  }

  console.log(`\nFound ${branchNames.length} unique branches:`);
  branchNames.slice(0, 20).forEach(n => console.log(' -', n));
  if (branchNames.length > 20) console.log(` ... and ${branchNames.length - 20} more`);

  if (DRY) {
    console.log('\n[dry] Not writing to DB (pass without --dry to upsert)');
    for (const name of branchNames) {
      const slug = slugify(name);
      console.log(`[dry] would upsert id=${slug} name="${name}" username="${slug}" password="${slug}"`);
    }
    process.exit(0);
  }

  await db.initDb();
  const pool = db.getPool();

  if (RESET) {
    console.log('\n[reset] TRUNCATE branches (CASCADE posts/resources/comments) ...');
    await pool.query('SET FOREIGN_KEY_CHECKS=0');
    await pool.query('TRUNCATE TABLE branches');
    await pool.query('SET FOREIGN_KEY_CHECKS=1');
  }

  console.log(`\n[db] Upserting into ${process.env.DB_NAME} @ ${process.env.DB_HOST} ...`);
  let inserted = 0, updated = 0;
  for (const name of branchNames) {
    const slug = slugify(name);
    const username = slug;
    const password = slug; // default password = username (user request: branch name as default username and password)
    const passwordHash = bcrypt.hashSync(password, 10);
    const id = slug;
    const [existing] = await pool.query('SELECT id FROM branches WHERE id=? OR username=? LIMIT 1', [id, username]);
    if (existing.length) {
      // update name if changed, but keep existing passwordHash unless you want to reset? We reset to default per request
      await pool.query('UPDATE branches SET name=?, username=?, passwordHash=?, homeTitle=?, homeSections=? WHERE id=?',
        [name, username, passwordHash, `Welcome to ${name}`, JSON.stringify([{ id: 's-' + Date.now(), image: '', text: `Welcome to ${name}! Visit aylus.org for activities.` }]), existing[0].id]);
      updated++;
    } else {
      await pool.query(
        'INSERT INTO branches (id, name, username, passwordHash, homeTitle, homeSections) VALUES (?,?,?,?,?,?)',
        [id, name, username, passwordHash, `Welcome to ${name}`, JSON.stringify([{ id: 's-' + Date.now(), image: '', text: `Welcome to ${name}!` }])]
      );
      inserted++;
    }
    if ((inserted + updated) % 20 === 0) console.log(`  ... ${inserted + updated}/${branchNames.length}`);
  }

  console.log(`\nDone: ${inserted} inserted, ${updated} updated, total ${branchNames.length}`);
  console.log(`\nDefault login for each branch: username = slug, password = same slug`);
  console.log(`Example: "Lake Washington, WA" -> username "lake-washington-wa" password "lake-washington-wa"`);
  console.log(`\nNext: export local dev DB and import to Hostinger prod:`);
  console.log(`  mysqldump -u ${process.env.DB_USER} -p ${process.env.DB_NAME} > dump.sql`);
  console.log(`  # then Hostinger hPanel -> phpMyAdmin -> ${process.env.DB_NAME} -> Import dump.sql`);
  console.log(`  # or CLI: mysql -h <prod_host> -u <prod_user> -p <prod_db> < dump.sql`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
