const path = require('path');
const fs = require('fs');
// Load .env.local first for localhost dev, fallback to .env (Hostinger)
const localEnv = path.join(__dirname, '.env.local');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
} else {
  require('dotenv').config();
}
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;

function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true,
  });
  return pool;
}

async function ensureDatabase() {
  // Create DB if not exists (needed for localhost .env.local where DB may not exist yet)
  const tmp = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  const dbName = process.env.DB_NAME;
  if (dbName) {
    await tmp.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  }
  await tmp.end();
}

async function initDb() {
  await ensureDatabase();
  const p = getPool();

  // Create tables if not exist
  await p.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      homeTitle TEXT,
      homeSections JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // add email column if upgrading from older schema
  try { await p.query(`ALTER TABLE branches ADD COLUMN email VARCHAR(255)`); } catch (e) { /* already exists */ }

  await p.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      branchId VARCHAR(64) NOT NULL,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expiresAt DATETIME NOT NULL,
      used TINYINT(1) DEFAULT 0,
      verified TINYINT(1) DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_branch (branchId),
      INDEX idx_code (code),
      INDEX idx_expires (expiresAt),
      CONSTRAINT fk_reset_branch FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id VARCHAR(64) PRIMARY KEY,
      branchId VARCHAR(64) NOT NULL,
      title VARCHAR(500) NOT NULL,
      date DATETIME NOT NULL,
      sections JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_branch_date (branchId, date),
      INDEX idx_date (date),
      CONSTRAINT fk_branch FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed if empty
  const [rows] = await p.query('SELECT COUNT(*) as c FROM branches');
  if (rows[0].c === 0) {
    await seed();
  }
}

async function seed() {
  const p = getPool();
  const hash1 = bcrypt.hashSync('branch1', 10);
  const hash2 = bcrypt.hashSync('branch2', 10);

  const branches = [
    {
      id: 'branch1',
      name: 'branch1',
      username: 'branch1',
      passwordHash: hash1,
      homeTitle: 'Welcome to Branch 1 - Aylus',
      homeSections: [
        { id: 's1', image: '', text: 'Branch 1 is dedicated to tutoring and volunteering in our local community. We host weekly tutoring sessions and community service events.' },
        { id: 's2', image: '', text: 'Join us to make a difference! Contact branch1 for upcoming opportunities.' }
      ]
    },
    {
      id: 'branch2',
      name: 'Branch 2 - Westside',
      username: 'branch2',
      passwordHash: hash2,
      homeTitle: 'Welcome to Branch 2 - Westside Chapter',
      homeSections: [
        { id: 's3', image: '', text: 'Westside chapter focuses on STEM volunteering and accessibility education.' }
      ]
    }
  ];

  for (const b of branches) {
    await p.query(
      'INSERT INTO branches (id, name, username, passwordHash, homeTitle, homeSections) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
      [b.id, b.name, b.username, b.passwordHash, b.homeTitle, JSON.stringify(b.homeSections)]
    );
  }

  const posts = [
    {
      id: 'post1',
      branchId: 'branch1',
      title: 'Summer Tutoring Volunteers Needed',
      date: new Date(Date.now() - 86400000 * 2),
      sections: [{ id: 'ps1', image: '', text: 'We are looking for math and science tutors for summer program. 2 hours/week commitment.' }]
    },
    {
      id: 'post2',
      branchId: 'branch2',
      title: 'Beach Cleanup - Volunteers Wanted',
      date: new Date(Date.now() - 86400000),
      sections: [{ id: 'ps2', image: '', text: 'Join our beach cleanup this Saturday 9am. Community service hours provided!' }]
    }
  ];

  for (const post of posts) {
    await p.query(
      'INSERT INTO posts (id, branchId, title, date, sections) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title)',
      [post.id, post.branchId, post.title, post.date, JSON.stringify(post.sections)]
    );
  }
}

// Helpers
function parseSections(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return val;
}

async function getBranches() {
  const [rows] = await getPool().query('SELECT id, name, username FROM branches ORDER BY id');
  return rows;
}

async function getBranchById(id) {
  const [rows] = await getPool().query('SELECT * FROM branches WHERE id=?', [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    username: r.username,
    passwordHash: r.passwordHash,
    email: r.email || '',
    home: {
      title: r.homeTitle || '',
      sections: parseSections(r.homeSections)
    }
  };
}

async function getBranchByUsername(username) {
  const [rows] = await getPool().query('SELECT * FROM branches WHERE username=?', [username]);
  return rows[0] || null;
}

async function updateBranchHome(id, title, sections) {
  await getPool().query('UPDATE branches SET homeTitle=?, homeSections=? WHERE id=?', [title, JSON.stringify(sections), id]);
  return { title, sections };
}

async function getBranchPosts(branchId, limit = 100, offset = 0) {
  limit = Math.max(0, parseInt(limit, 10) || 0);
  offset = Math.max(0, parseInt(offset, 10) || 0);
  const [rows] = await getPool().query(
    `SELECT * FROM posts WHERE branchId=? ORDER BY date DESC LIMIT ${limit} OFFSET ${offset}`,
    [branchId]
  );
  return rows.map(r => ({
    id: r.id,
    branchId: r.branchId,
    title: r.title,
    date: r.date,
    sections: parseSections(r.sections)
  }));
}

async function getAllPosts(limit = 100, offset = 0) {
  // Enriched with branch name via join, paginated - inline limit/offset for MariaDB (needs integers, not quoted strings)
  limit = Math.max(0, parseInt(limit, 10) || 0);
  offset = Math.max(0, parseInt(offset, 10) || 0);
  const [rows] = await getPool().query(
    `SELECT p.*, b.name as branchName FROM posts p
     LEFT JOIN branches b ON b.id = p.branchId
     ORDER BY p.date DESC LIMIT ${limit} OFFSET ${offset}`,
    []);
  return rows.map(r => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branchName || r.branchId,
    title: r.title,
    date: r.date,
    sections: parseSections(r.sections)
  }));
}

async function createPost({ id, branchId, title, sections }) {
  const date = new Date();
  await getPool().query('INSERT INTO posts (id, branchId, title, date, sections) VALUES (?,?,?,?,?)', [id, branchId, title, date, JSON.stringify(sections)]);
  return { id, branchId, title, date: date.toISOString(), sections };
}

async function updatePost(branchId, postId, { title, sections }) {
  const fields = [];
  const vals = [];
  if (title !== undefined) { fields.push('title=?'); vals.push(title); }
  if (sections !== undefined) { fields.push('sections=?'); vals.push(JSON.stringify(sections)); }
  if (fields.length === 0) return null;
  vals.push(postId, branchId);
  const [res] = await getPool().query(`UPDATE posts SET ${fields.join(', ')} WHERE id=? AND branchId=?`, vals);
  if (res.affectedRows === 0) return null;
  const [rows] = await getPool().query('SELECT * FROM posts WHERE id=? AND branchId=?', [postId, branchId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, branchId: r.branchId, title: r.title, date: r.date, sections: parseSections(r.sections) };
}

async function deletePost(branchId, postId) {
  const [res] = await getPool().query('DELETE FROM posts WHERE id=? AND branchId=?', [postId, branchId]);
  return res.affectedRows > 0;
}

async function updateBranchEmailAndPassword(branchId, email, passwordHash) {
  if (email) {
    await getPool().query('UPDATE branches SET email=?, passwordHash=? WHERE id=?', [email, passwordHash, branchId]);
  } else {
    await getPool().query('UPDATE branches SET passwordHash=? WHERE id=?', [passwordHash, branchId]);
  }
}

async function createPasswordReset(branchId, email, code, expiresAt) {
  // invalidate old unused codes for this branch
  await getPool().query('UPDATE password_resets SET used=1 WHERE branchId=? AND used=0', [branchId]);
  await getPool().query('INSERT INTO password_resets (branchId, email, code, expiresAt) VALUES (?,?,?,?)', [branchId, email, code, expiresAt]);
}

async function getValidReset(branchId, code) {
  const [rows] = await getPool().query(
    'SELECT * FROM password_resets WHERE branchId=? AND code=? AND used=0 AND expiresAt > NOW() ORDER BY id DESC LIMIT 1',
    [branchId, code]
  );
  return rows[0] || null;
}

async function verifyResetCode(branchId, code) {
  const reset = await getValidReset(branchId, code);
  if (!reset) return null;
  await getPool().query('UPDATE password_resets SET verified=1 WHERE id=?', [reset.id]);
  return reset;
}

async function consumeReset(branchId, code) {
  const [rows] = await getPool().query(
    'SELECT * FROM password_resets WHERE branchId=? AND code=? AND verified=1 AND used=0 AND expiresAt > NOW() ORDER BY id DESC LIMIT 1',
    [branchId, code]
  );
  const reset = rows[0];
  if (!reset) return null;
  await getPool().query('UPDATE password_resets SET used=1 WHERE id=?', [reset.id]);
  return reset;
}

async function countPosts() {
  const [rows] = await getPool().query('SELECT COUNT(*) as c FROM posts');
  return rows[0].c;
}

module.exports = {
  getPool,
  initDb,
  seed,
  getBranches,
  getBranchById,
  getBranchByUsername,
  updateBranchHome,
  getBranchPosts,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
  countPosts,
  updateBranchEmailAndPassword,
  createPasswordReset,
  getValidReset,
  verifyResetCode,
  consumeReset,
};
