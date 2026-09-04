const path = require('path');
const fs = require('fs');
const localEnv = path.join(__dirname, '.env.local');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
} else {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'aylus-dev-secret-please-change';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// static for uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random()*1e9) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 } });

// --- auth middleware ---
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing token' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireBranchOwner(req, res, next) {
  const { id } = req.params;
  if (req.user.branchId !== id && req.user.role !== 'super') {
    return res.status(403).json({ error: 'Forbidden: not owner of this branch' });
  }
  next();
}

// --- routes ---

// GET branches
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await db.getBranches();
    res.json(branches);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET single branch
app.get('/api/branches/:id', async (req, res) => {
  try {
    const b = await db.getBranchById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Branch not found' });
    const { passwordHash, ...safe } = b;
    res.json(safe);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// PUT home (auth)
app.put('/api/branches/:id/home', auth, requireBranchOwner, async (req, res) => {
  try {
    const { title, sections } = req.body;
    if (typeof title !== 'string') return res.status(400).json({ error: 'title required' });
    if (!Array.isArray(sections)) return res.status(400).json({ error: 'sections must be array' });
    const b = await db.getBranchById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Branch not found' });
    const home = await db.updateBranchHome(req.params.id, title, sections);
    res.json(home);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// helper: password strength
function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  const digits = (pw.match(/\d/g) || []).length;
  if (digits < 2) return 'Password must contain at least 2 digits';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  return null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendVerificationEmail(to, code) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER) {
    console.log(`[DEV EMAIL] Verification code for ${to}: ${code} (expires 5 min)`);
    return { devMode: true };
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: Number(SMTP_PORT || 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject: 'Aylus - Password Reset Verification Code',
    text: `Your verification code is: ${code}\nIt expires in 5 minutes.`,
    html: `<p>Your verification code is: <b style="font-size:20px;letter-spacing:3px">${code}</b></p><p>It expires in 5 minutes. Do not share it.</p>`,
  });
  return { devMode: false };
}

// POST login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const branch = await db.getBranchByUsername(username);
    if (!branch) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, branch.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ branchId: branch.id, username: branch.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, branch: { id: branch.id, name: branch.name, username: branch.username } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST request password change - step 1: enter email twice
app.post('/api/auth/request-password-reset', auth, async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { email, confirmEmail } = req.body;
    if (!email || !confirmEmail) return res.status(400).json({ error: 'Email and confirm email required' });
    if (email !== confirmEmail) return res.status(400).json({ error: 'Emails do not match' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await db.createPasswordReset(branchId, email, code, expiresAt);
    const result = await sendVerificationEmail(email, code);

    res.json({
      ok: true,
      message: 'Verification code sent to email (expires in 5 minutes)',
      expiresAt: expiresAt.toISOString(),
      // in dev mode return code for testing
      ...(result.devMode ? { devCode: code, devMode: true } : {})
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST verify code - step 2: waiting for verification
app.post('/api/auth/verify-reset-code', auth, async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const reset = await db.verifyResetCode(branchId, code);
    if (!reset) return res.status(400).json({ error: 'Invalid or expired code' });
    res.json({ ok: true, message: 'Code verified, you can now set new password' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST reset password - step 3: set new password
app.post('/api/auth/reset-password', auth, async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { code, newPassword } = req.body;
    if (!code || !newPassword) return res.status(400).json({ error: 'Code and newPassword required' });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const reset = await db.consumeReset(branchId, code);
    if (!reset) return res.status(400).json({ error: 'Invalid, unverified or expired code. Please request a new code and verify first.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.updateBranchEmailAndPassword(branchId, reset.email, hash);

    res.json({ ok: true, message: 'Password updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET branch posts (paginated)
app.get('/api/branches/:id/posts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const posts = await db.getBranchPosts(req.params.id, limit, offset);
    res.json(posts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET all posts (org home shared, paginated)
app.get('/api/posts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const posts = await db.getAllPosts(limit, offset);
    res.json(posts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST create post
app.post('/api/branches/:id/posts', auth, requireBranchOwner, async (req, res) => {
  try {
    const { title, sections } = req.body;
    if (!title || !Array.isArray(sections)) return res.status(400).json({ error: 'title and sections required' });
    const newPost = await db.createPost({
      id: 'post-' + Date.now() + '-' + Math.round(Math.random()*1000),
      branchId: req.params.id,
      title,
      sections
    });
    res.status(201).json(newPost);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// PUT update post
app.put('/api/branches/:id/posts/:postId', auth, requireBranchOwner, async (req, res) => {
  try {
    const { title, sections } = req.body;
    const updated = await db.updatePost(req.params.id, req.params.postId, { title, sections });
    if (!updated) return res.status(404).json({ error: 'Post not found' });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// DELETE post
app.delete('/api/branches/:id/posts/:postId', auth, requireBranchOwner, async (req, res) => {
  try {
    const ok = await db.deletePost(req.params.id, req.params.postId);
    if (!ok) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// image upload
app.post('/api/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// health (also checks DB)
app.get('/api/health', async (req,res)=> {
  try {
    await db.getPool().query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'disconnected', error: e.message });
  }
});

// serve frontend dist if built (fixes Cannot GET / on Hostinger Shared/Cloud)
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: serve index.html for non-api routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.json({ message: 'API running. Frontend not built - run: cd frontend && npm install && npm run build' }));
}

async function start() {
  try {
    await db.initDb();
    console.log('MySQL connected and tables ready');
  } catch (e) {
    console.error('Failed to init MySQL:', e.message);
    console.error('Check .env DB_HOST/DB_USER/DB_PASSWORD/DB_NAME from Hostinger hPanel > Databases');
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

start();
