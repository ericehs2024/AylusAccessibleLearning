/**
 * Dump local dev DB (aylus_local) to dump.sql without needing mysqldump.exe
 * Uses Node mysql2 to generate compatible SQL for Hostinger import.
 *
 * Usage (PowerShell):
 *   node scripts/dump-local.js
 *   # creates dump.sql in backend/ (or backend/dump.sql)
 *   # then upload via Hostinger hPanel -> phpMyAdmin -> Import
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const localEnv = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(localEnv)) require('dotenv').config({ path: localEnv, override: true });
const mysql = require('mysql2/promise');

async function dump() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true, connectionLimit: 2,
  });

  const dbName = process.env.DB_NAME;
  console.log(`[dump] Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT} / ${dbName} as ${process.env.DB_USER}`);

  const tables = ['branches', 'posts', 'resources', 'comments', 'password_resets'];
  let sql = `-- Dump of ${dbName} generated ${new Date().toISOString()}\n`;
  sql += `-- Compatible with Hostinger import (no CREATE DATABASE)\n`;
  sql += `SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`;

  for (const table of tables) {
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      if (!rows.length) {
        console.log(`[dump] ${table}: 0 rows (skip)`);
        continue;
      }
      console.log(`[dump] ${table}: ${rows.length} rows`);
      sql += `-- Table ${table} (${rows.length} rows)\n`;
      sql += `DELETE FROM \`${table}\`;\n`;
      // Build INSERT
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
          if (Buffer.isBuffer(v)) return `'${v.toString('utf8').replace(/'/g, "''")}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO \`${table}\` (\`${cols.join('`, `')}\`) VALUES (${vals.join(', ')});\n`;
      }
      sql += `\n`;
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') console.log(`[dump] ${table}: table not exists, skip`);
      else console.warn(`[dump] ${table} error:`, e.message);
    }
  }

  sql += `SET FOREIGN_KEY_CHECKS=1;\n`;
  const outPath = path.join(__dirname, '..', 'dump.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log(`\n[dump] Wrote ${outPath} (${(fs.statSync(outPath).size/1024).toFixed(1)} KB)`);
  console.log(`Next: Hostinger hPanel -> phpMyAdmin -> select u133287421_learning -> Import -> dump.sql`);
  await pool.end();
}

dump().catch(e => { console.error(e); process.exit(1); });
