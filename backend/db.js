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
      requiredAges VARCHAR(255),
      location VARCHAR(500),
      signUpLink TEXT,
      extraDescription TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_branch_date (branchId, date),
      INDEX idx_date (date),
      CONSTRAINT fk_branch FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // add wireframe columns if upgrading from older schema
  try { await p.query(`ALTER TABLE posts ADD COLUMN requiredAges VARCHAR(255)`); } catch (e) { /* already exists */ }
  try { await p.query(`ALTER TABLE posts ADD COLUMN location VARCHAR(500)`); } catch (e) { /* already exists */ }
  try { await p.query(`ALTER TABLE posts ADD COLUMN signUpLink TEXT`); } catch (e) { /* already exists */ }
  try { await p.query(`ALTER TABLE posts ADD COLUMN extraDescription TEXT`); } catch (e) { /* already exists */ }

  await p.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id VARCHAR(64) PRIMARY KEY,
      postId VARCHAR(64) NOT NULL,
      authorName VARCHAR(255) NOT NULL,
      text TEXT NOT NULL,
      createdAt DATETIME NOT NULL,
      INDEX idx_post (postId),
      INDEX idx_created (createdAt),
      CONSTRAINT fk_comment_post FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
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
      sections: [{ id: 'ps1', image: '', text: 'We are looking for math and science tutors for summer program. 2 hours/week commitment.' }],
      requiredAges: '14-18',
      location: 'Zoom',
      signUpLink: 'https://forms.gle/example1',
      extraDescription: 'Help middle school students with math and reading. Training provided. Flexible timing.'
    },
    {
      id: 'post2',
      branchId: 'branch2',
      title: 'Beach Cleanup - Volunteers Wanted',
      date: new Date(Date.now() - 86400000),
      sections: [{ id: 'ps2', image: '', text: 'Join our beach cleanup this Saturday 9am. Community service hours provided!' }],
      requiredAges: 'All ages',
      location: 'Santa Monica Beach',
      signUpLink: '',
      extraDescription: 'Past beach cleanup - thank you to all volunteers who joined!'
    },
    {
      id: 'post3',
      branchId: 'branch1',
      title: 'Upcoming: STEM Workshop for Kids',
      date: new Date(Date.now() + 86400000 * 7),
      sections: [{ id: 'ps3', image: '', text: 'Hands-on STEM activities for elementary students. Volunteers guide small groups through experiments.' }],
      requiredAges: '16+',
      location: 'Zoom + In-person (Library)',
      signUpLink: 'https://forms.gle/example3',
      extraDescription: 'Upcoming interactive workshop covering robotics and coding basics. Volunteers needed as mentors.'
    }
  ];

  for (const post of posts) {
    await p.query(
      'INSERT INTO posts (id, branchId, title, date, sections, requiredAges, location, signUpLink, extraDescription) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title), requiredAges=VALUES(requiredAges), location=VALUES(location), signUpLink=VALUES(signUpLink), extraDescription=VALUES(extraDescription)',
      [post.id, post.branchId, post.title, post.date, JSON.stringify(post.sections), post.requiredAges, post.location, post.signUpLink, post.extraDescription]
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
    sections: parseSections(r.sections),
    requiredAges: r.requiredAges || '',
    location: r.location || '',
    signUpLink: r.signUpLink || '',
    extraDescription: r.extraDescription || ''
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
    sections: parseSections(r.sections),
    requiredAges: r.requiredAges || '',
    location: r.location || '',
    signUpLink: r.signUpLink || '',
    extraDescription: r.extraDescription || ''
  }));
}

async function createPost({ id, branchId, title, sections, requiredAges, location, signUpLink, extraDescription, date }) {
  const postDate = date ? new Date(date) : new Date();
  await getPool().query('INSERT INTO posts (id, branchId, title, date, sections, requiredAges, location, signUpLink, extraDescription) VALUES (?,?,?,?,?,?,?,?,?)', [id, branchId, title, postDate, JSON.stringify(sections || []), requiredAges || null, location || null, signUpLink || null, extraDescription || null]);
  return { id, branchId, title, date: postDate.toISOString(), sections: sections || [], requiredAges: requiredAges || '', location: location || '', signUpLink: signUpLink || '', extraDescription: extraDescription || '' };
}

async function updatePost(branchId, postId, { title, sections, requiredAges, location, signUpLink, extraDescription, date }) {
  const fields = [];
  const vals = [];
  if (title !== undefined) { fields.push('title=?'); vals.push(title); }
  if (sections !== undefined) { fields.push('sections=?'); vals.push(JSON.stringify(sections)); }
  if (requiredAges !== undefined) { fields.push('requiredAges=?'); vals.push(requiredAges); }
  if (location !== undefined) { fields.push('location=?'); vals.push(location); }
  if (signUpLink !== undefined) { fields.push('signUpLink=?'); vals.push(signUpLink); }
  if (extraDescription !== undefined) { fields.push('extraDescription=?'); vals.push(extraDescription); }
  if (date !== undefined) { fields.push('date=?'); vals.push(new Date(date)); }
  if (fields.length === 0) return null;
  vals.push(postId, branchId);
  const [res] = await getPool().query(`UPDATE posts SET ${fields.join(', ')} WHERE id=? AND branchId=?`, vals);
  if (res.affectedRows === 0) return null;
  const [rows] = await getPool().query('SELECT * FROM posts WHERE id=? AND branchId=?', [postId, branchId]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, branchId: r.branchId, title: r.title, date: r.date, sections: parseSections(r.sections), requiredAges: r.requiredAges || '', location: r.location || '', signUpLink: r.signUpLink || '', extraDescription: r.extraDescription || '' };
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

async function getPostById(postId) {
  // support both raw and prefixed ids: e.g. post-178... vs 178...
  const candidates = [postId]
  if (postId.startsWith('post-')) candidates.push(postId.slice(5))
  else candidates.push('post-' + postId)
  // try each candidate
  for (const cand of candidates) {
    const [rows] = await getPool().query(
      `SELECT p.*, b.name as branchName FROM posts p LEFT JOIN branches b ON b.id = p.branchId WHERE p.id=? LIMIT 1`,
      [cand]
    );
    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: r.id,
        branchId: r.branchId,
        branchName: r.branchName || r.branchId,
        title: r.title,
        date: r.date,
        sections: parseSections(r.sections),
        requiredAges: r.requiredAges || '',
        location: r.location || '',
        signUpLink: r.signUpLink || '',
        extraDescription: r.extraDescription || ''
      };
    }
  }
  return null;
}

async function getPostComments(postId) {
  // try both prefixed and raw ids for compatibility
  const candidates = [postId]
  if (postId.startsWith('post-')) candidates.push(postId.slice(5))
  else candidates.push('post-' + postId)
  const placeholders = candidates.map(()=>'?').join(',')
  const [rows] = await getPool().query(
    `SELECT * FROM comments WHERE postId IN (${placeholders}) ORDER BY createdAt ASC`,
    candidates
  );
  return rows.map(r => ({
    id: r.id,
    postId: r.postId,
    authorName: r.authorName,
    text: r.text,
    createdAt: r.createdAt
  }));
}

async function createComment({ id, postId, authorName, text }) {
  const createdAt = new Date();
  await getPool().query(
    'INSERT INTO comments (id, postId, authorName, text, createdAt) VALUES (?,?,?,?,?)',
    [id, postId, authorName, text, createdAt]
  );
  return { id, postId, authorName, text, createdAt: createdAt.toISOString() };
}

async function deleteComment(postId, commentId) {
  const candidates = [postId]
  if (postId.startsWith('post-')) candidates.push(postId.slice(5))
  else candidates.push('post-' + postId)
  const placeholders = candidates.map(()=>'?').join(',')
  const [res] = await getPool().query(`DELETE FROM comments WHERE id=? AND postId IN (${placeholders})`, [commentId, ...candidates]);
  return res.affectedRows > 0;
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
  getPostById,
  getPostComments,
  createComment,
  deleteComment,
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
