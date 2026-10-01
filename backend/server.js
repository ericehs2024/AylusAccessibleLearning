const path = require('path');
const fs = require('fs');
// Load base .env first, then override with .env.local if present (so SMTP from .env is retained locally unless overridden)
require('dotenv').config();
const localEnv = path.join(__dirname, '.env.local');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv, override: true });
}
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./db');
const { registerScraperRoutes } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'aylus-dev-secret-please-change';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'superadmin123';

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
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } });

// --- resource upload: limit to common documents + videos ---
const ALLOWED_RESOURCE_EXTS = ['.pdf','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.txt','.csv','.rtf','.odt','.ods','.odp','.mp4','.mov','.avi','.webm','.mkv'];
const ALLOWED_RESOURCE_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv','application/csv','text/rtf','application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'video/mp4','video/quicktime','video/x-msvideo','video/webm','video/x-matroska',
]);
function isAllowedResourceFile(file){
  const ext = path.extname(file.originalname).toLowerCase();
  if(ALLOWED_RESOURCE_EXTS.includes(ext)) return true;
  // also allow by MIME for files without extension mismatch (e.g. browser reports correctly)
  if(ALLOWED_RESOURCE_MIMES.has(file.mimetype.toLowerCase())) return true;
  // text/* with allowed ext fallback already covers txt/csv
  return false;
}
const resourceUpload = multer({
  storage,
  limits: { fileSize: 10*1024*1024 },
  fileFilter: (req, file, cb) => {
    if(isAllowedResourceFile(file)) return cb(null, true);
    req.fileValidationError = `Invalid file type. Allowed documents: ${ALLOWED_RESOURCE_EXTS.join(', ')}`;
    return cb(null, false);
  }
});

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
  if (req.user.branchId !== id && req.user.role !== 'super' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: not owner of this branch' });
  }
  next();
}

function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing token' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden: admin only' });
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
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
  // If SMTP not configured, fall back to dev mode (console log + return code to client)
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`[DEV EMAIL] Verification code for ${to}: ${code} (expires 5 min) — SMTP not configured, using dev mode`);
    return { devMode: true };
  }
  try {
    const nodemailer = require('nodemailer');
    const port = Number(SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    // verify connection before sending for clearer error
    await transporter.verify().catch(e => {
      console.warn('[EMAIL] SMTP verify warning:', e.message);
    });
    const info = await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: 'Aylus - Password Reset Verification Code',
      text: `Your verification code is: ${code}\nIt expires in 5 minutes. Do not share it.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><p>Your verification code is:</p><p><b style="font-size:22px;letter-spacing:4px;background:#f1f3f4;padding:8px 14px;border-radius:8px">${code}</b></p><p>It expires in <b>5 minutes</b>. Do not share it.</p><p style="color:#5f6368;font-size:12px">Aylus Accessible Learning</p></div>`,
    });
    console.log(`[EMAIL] Verification code sent to ${to} via ${SMTP_HOST} (messageId: ${info.messageId})`);
    return { devMode: false };
  } catch (e) {
    console.error(`[EMAIL] Failed to send verification code to ${to}:`, e.message);
    // Don't expose code to client when SMTP is configured — throw so caller returns 500 with clear error
    throw new Error(`Failed to send email via ${SMTP_HOST}: ${e.message}`);
  }
}

// POST login (branch) - rejects admin username to prevent conflict
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    // prevent admin username from being used as branch login
    if (username.trim() === ADMIN_USERNAME) {
      return res.status(401).json({ error: 'Invalid credentials. Admin accounts must use /admin login.' });
    }
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
    console.error('[request-password-reset] error:', e);
    // surface SMTP errors to client for debugging (contains Failed to send email prefix)
    const isEmailError = e.message && e.message.includes('Failed to send email');
    res.status(500).json({ error: isEmailError ? e.message : 'Failed to send verification code' });
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

// POST reset password - step 3: set new password (authenticated flow)
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

// POST change password — authenticated, requires old password (no email)
app.post('/api/auth/change-password', auth, async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });
    if (oldPassword === newPassword) return res.status(400).json({ error: 'New password must differ from old password' });
    const branch = await db.getBranchById(branchId);
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const ok = await bcrypt.compare(oldPassword, branch.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.updateBranchEmailAndPassword(branchId, null, hash);
    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// --- unauthenticated forgot/reset password flow (for Login -> Forgot password) ---
// POST /api/auth/forgot/request { username, email, confirmEmail } -> sends verification code to email
app.post('/api/auth/forgot/request', async (req, res) => {
  try {
    const { username, email, confirmEmail } = req.body;
    if (!username || !email || !confirmEmail) return res.status(400).json({ error: 'username, email and confirmEmail required' });
    if (email !== confirmEmail) return res.status(400).json({ error: 'Emails do not match' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    const branch = await db.getBranchByUsername(username.trim());
    if (!branch) return res.status(404).json({ error: 'Branch username not found' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.createPasswordReset(branch.id, email, code, expiresAt);
    const result = await sendVerificationEmail(email, code);
    res.json({
      ok: true,
      message: 'Verification code sent to email (expires in 5 minutes)',
      expiresAt: expiresAt.toISOString(),
      ...(result.devMode ? { devCode: code, devMode: true } : {})
    });
  } catch (e) {
    console.error('[forgot/request] error:', e);
    const isEmailError = e.message && e.message.includes('Failed to send email');
    res.status(500).json({ error: isEmailError ? e.message : 'Failed to send verification code' });
  }
});

app.post('/api/auth/forgot/verify', async (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code) return res.status(400).json({ error: 'username and code required' });
    const branch = await db.getBranchByUsername(username.trim());
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const reset = await db.verifyResetCode(branch.id, code);
    if (!reset) return res.status(400).json({ error: 'Invalid or expired code' });
    res.json({ ok: true, message: 'Code verified' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/auth/forgot/reset', async (req, res) => {
  try {
    const { username, code, newPassword } = req.body;
    if (!username || !code || !newPassword) return res.status(400).json({ error: 'username, code and newPassword required' });
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });
    const branch = await db.getBranchByUsername(username.trim());
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const reset = await db.consumeReset(branch.id, code);
    if (!reset) return res.status(400).json({ error: 'Invalid, unverified or expired code' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.updateBranchEmailAndPassword(branch.id, reset.email, hash);
    res.json({ ok: true, message: 'Password reset successfully' });
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

// GET single post by id (for post detail page)
app.get('/api/posts/:postId', async (req, res) => {
  try {
    const post = await db.getPostById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET comments for a post
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const post = await db.getPostById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comments = await db.getPostComments(req.params.postId);
    res.json(comments);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST comment to a post (open to all, no auth required)
app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { authorName, text } = req.body;
    if (!authorName || !authorName.trim()) return res.status(400).json({ error: 'Name required' });
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });
    if (text.length > 2000) return res.status(400).json({ error: 'Comment too long (max 2000 chars)' });
    const post = await db.getPostById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = await db.createComment({
      id: 'cmt-' + Date.now() + '-' + Math.round(Math.random()*10000),
      postId: post.id, // use canonical id (handles post- prefix stripping for URL /branches/.../posts/178... )
      authorName: authorName.trim().slice(0,80),
      text: text.trim()
    });
    res.status(201).json(comment);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// DELETE comment - ONLY the branch admin who owns the post's branch can delete
app.delete('/api/posts/:postId/comments/:commentId', auth, async (req, res) => {
  try {
    const post = await db.getPostById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!req.user.branchId || req.user.branchId !== post.branchId) {
      return res.status(403).json({ error: 'Only the branch admin for this post can delete comments' });
    }
    const ok = await db.deleteComment(post.id, req.params.commentId);
    if (!ok) return res.status(404).json({ error: 'Comment not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST create post (wireframe fields: requiredAges, location, signUpLink, volunteersNeeded, volunteerStatus, extraDescription, date)
app.post('/api/branches/:id/posts', auth, requireBranchOwner, async (req, res) => {
  try {
    const { title, sections, requiredAges, location, signUpLink, volunteersNeeded, volunteerStatus, extraDescription, date } = req.body;
    if (!title || !Array.isArray(sections)) return res.status(400).json({ error: 'title and sections required' });
    const newPost = await db.createPost({
      id: 'post-' + Date.now() + '-' + Math.round(Math.random()*1000),
      branchId: req.params.id,
      title,
      sections,
      requiredAges,
      location,
      signUpLink,
      volunteersNeeded,
      volunteerStatus,
      extraDescription,
      date
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
    const { title, sections, requiredAges, location, signUpLink, volunteersNeeded, volunteerStatus, extraDescription, date } = req.body;
    const updated = await db.updatePost(req.params.id, req.params.postId, { title, sections, requiredAges, location, signUpLink, volunteersNeeded, volunteerStatus, extraDescription, date });
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

// resource file upload — limited to common documents (up to 20MB)
app.post('/api/upload/resource', auth, resourceUpload.single('file'), (req, res) => {
  if (req.fileValidationError) return res.status(400).json({ error: req.fileValidationError });
  if (!req.file) return res.status(400).json({ error: `No file or invalid file type. Allowed: ${ALLOWED_RESOURCE_EXTS.join(', ')}` });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, fileName: req.file.originalname, fileType: req.file.mimetype, size: req.file.size });
});

// --- resources (branch uploads, searchable with labels) ---
const RESOURCE_CATEGORIES = ['powerpoints', 'lesson plans', 'teaching tips', 'worksheets', 'videos', 'other'];

// helper: check if request has valid branch/admin JWT — for gating fileUrl so only logged-in branch accounts can download
function isRequestAuthed(req){
  const header = req.headers.authorization;
  if(!header) return false;
  const token = header.split(' ')[1];
  if(!token) return false;
  try { jwt.verify(token, JWT_SECRET); return true; } catch { return false; }
}
function stripResourceForGuest(r){
  if(!r) return r;
  const { fileUrl, fileName, fileType, description, ...rest } = r;
  // keep title/category/branchName visible, hide fileUrl + file details + description for guests
  return { ...rest, fileUrl: null, fileName: null, fileType: null, description: null };
}

app.get('/api/resources', async (req, res) => {
  try {
    const { q, category, branchId, limit, offset } = req.query;
    const list = await db.getAllResources({ q, category, branchId, limit: limit || 100, offset: offset || 0 });
    const authed = isRequestAuthed(req);
    res.json(authed ? list : list.map(stripResourceForGuest));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/resources/:id', async (req, res) => {
  try {
    const r = await db.getResourceById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Resource not found' });
    const authed = isRequestAuthed(req);
    res.json(authed ? r : stripResourceForGuest(r));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/branches/:id/resources', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const list = await db.getBranchResources(req.params.id, limit, offset);
    const authed = isRequestAuthed(req);
    res.json(authed ? list : list.map(stripResourceForGuest));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/branches/:id/resources', auth, requireBranchOwner, async (req, res) => {
  try {
    const { title, category, description, fileUrl, fileName, fileType } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
    if (category && !RESOURCE_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid category. Allowed: ' + RESOURCE_CATEGORIES.join(', ') });
    }
    const r = await db.createResource({
      id: 'res-' + Date.now() + '-' + Math.round(Math.random()*10000),
      branchId: req.params.id,
      title: title.trim(),
      category: category || 'other',
      description: description || '',
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
    });
    res.status(201).json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.put('/api/branches/:id/resources/:resourceId', auth, requireBranchOwner, async (req, res) => {
  try {
    const { title, category, description, fileUrl, fileName, fileType } = req.body;
    if (category && !RESOURCE_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    const updated = await db.updateResource(req.params.id, req.params.resourceId, {
      title: title !== undefined ? title.trim() : undefined,
      category,
      description,
      fileUrl,
      fileName,
      fileType,
    });
    if (!updated) return res.status(404).json({ error: 'Resource not found' });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.delete('/api/branches/:id/resources/:resourceId', auth, requireBranchOwner, async (req, res) => {
  try {
    const ok = await db.deleteResource(req.params.id, req.params.resourceId);
    if (!ok) return res.status(404).json({ error: 'Resource not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// --- admin (username + password from .env) ---
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.trim() !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    const token = jwt.sign({ role: 'admin', username: ADMIN_USERNAME }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/branches', adminAuth, async (req, res) => {
  try {
    const branches = await db.getBranches();
    // return full list for admin panel (without passwordHash)
    const detailed = await Promise.all(branches.map(b => db.getBranchById(b.id)));
    const safe = detailed.filter(Boolean).map(b => ({ id: b.id, name: b.name, username: b.username, email: b.email, featured: !!b.featured }));
    res.json(safe);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Hour Compiler run logs for review (newest first, paginated)
app.get('/api/admin/scrape-logs', adminAuth, async (req, res) => {
  try {
    const logs = await db.getScrapeLogs(req.query.limit || 100, req.query.offset || 0);
    res.json(logs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// --- site analytics (public beacon + admin summary) ---
// POST /api/analytics/track { eventType: pageview|branch_login|branch_password_change|admin_login, path?, branchId?, meta? }
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { eventType, path, branchId, meta } = req.body || {};
    if (!db.ANALYTICS_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ error: 'Invalid eventType' });
    }
    // prefer branchId from a valid branch JWT over client-supplied value
    let resolvedBranchId = branchId || null;
    const header = req.headers.authorization;
    if (header) {
      try {
        const payload = jwt.verify(header.split(' ')[1], JWT_SECRET);
        if (payload.branchId) resolvedBranchId = payload.branchId;
      } catch { /* anonymous or admin token — keep client value */ }
    }
    db.logAnalyticsEvent({ eventType, branchId: resolvedBranchId, path, meta });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Aggregated stats for the admin dashboard: daily pageviews / password changes /
// admin logins, most active branches, most used pages
app.get('/api/admin/analytics', adminAuth, async (req, res) => {
  try {
    res.json(await db.getAnalyticsSummary(req.query.days || 30));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Mark/unmark a branch as featured (spotlight section on the Branches tab)
app.put('/api/admin/branches/:id/featured', adminAuth, async (req, res) => {
  try {
    const ok = await db.setBranchFeatured(req.params.id, !!req.body.featured);
    if (!ok) return res.status(404).json({ error: 'Branch not found' });
    res.json({ ok: true, featured: !!req.body.featured });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/admin/branches', adminAuth, async (req, res) => {
  try {
    let { name, username, password, email } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Branch name required' });
    if (!username || !username.trim()) return res.status(400).json({ error: 'Username required' });
    if (!password) return res.status(400).json({ error: 'Password required' });
    name = name.trim();
    username = username.trim();
    // prevent branch username from colliding with admin username
    if (username === ADMIN_USERNAME) return res.status(409).json({ error: `Username "${ADMIN_USERNAME}" is reserved for admin and cannot be used for branches` });
    // validate uniqueness
    const existing = await db.getBranchByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    // optional: id collision check by same as username lowercased
    let id = username.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || ('branch-' + Date.now());
    const existingById = await db.getBranchById(id);
    if (existingById) id = id + '-' + Date.now().toString(36);
    if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (password.length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });
    const hash = await bcrypt.hash(password, 10);
    const branch = await db.createBranch({ id, name, username, passwordHash: hash, email: email || null });
    const { passwordHash, ...safe } = branch;
    // also return without hash
    res.status(201).json({ id: branch.id, name: branch.name, username: branch.username, email: branch.email || '' });
  } catch (e) {
    console.error(e);
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Branch already exists (duplicate name/username)' });
    res.status(500).json({ error: 'DB error' });
  }
});

// super-admin can delete any post (branch check bypassed)
app.delete('/api/admin/posts/:postId', adminAuth, async (req, res) => {
  try {
    const post = await db.getPostById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const ok = await db.deletePost(post.branchId, post.id);
    if (!ok) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// Volunteer Platform scraper (ported from aylus)
registerScraperRoutes(app);

// health (also checks DB)
app.get('/api/health', async (req,res)=> {
  try {
    await db.getPool().query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'disconnected', error: e.message });
  }
});

// multer/global upload error handler — all files capped at 10MB
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 10MB). Files larger than 10MB, please add as links in the description.' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message || 'Upload error' });
  next();
});

// serve frontend dist if built (fixes Cannot GET / on Hostinger)
// supports both dev layout (../frontend/dist) and deploy.zip layout (./dist)
const frontendDistCandidates = [
  path.join(__dirname, '../frontend/dist'),
  path.join(__dirname, 'dist')
];
let frontendDist = null;
for (const p of frontendDistCandidates) {
  if (fs.existsSync(p)) { frontendDist = p; break; }
}
if (frontendDist) {
  app.use(express.static(frontendDist));
  // SPA fallback: serve index.html for non-api routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.json({ message: 'API running. Frontend not built - run: cd frontend && npm install && npm run build or npm run deploy' }));
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
