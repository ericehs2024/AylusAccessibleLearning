# Aylus Accessible Learning — Multi-Branch Platform

Node.js (Express) backend + React Vite frontend for a non-profit with multiple branches. Now backed by **Hostinger MySQL**.

## Features
- **Organization home** at `/` — shows all branches + aggregated shared posts from every branch (paginated).
- **Branch home** at `/branch/:id` — title + repeatable sections (image + textarea).
- **Branch posts** at `/branch/:id/posts` — posts auto-dated, clearly separated.
- **Branch admin**: login with `branch1 / branch1` or `branch2 / branch2`, then edit home (`/branch/:id/admin/home`) and posts (`/branch/:id/admin/posts`).
- MySQL tables `branches` / `posts` with `JSON` columns for sections, indexed on `branchId, date`. Supports 150+ branches. Uploaded images served from `/uploads`.

## Hostinger MySQL Setup
1. Hostinger hPanel → **Databases → MySQL Databases** → Create database + user. Note `Host`, `User`, `Database` (often `localhost`, `uXXXX_...`).
2. If external access needed: **Databases → Remote MySQL** → allow your IP or use Hostinger's internal host for deployment on same Hostinger VPS.
3. Copy `backend/.env.example` to `backend/.env` and fill:
   ```
   DB_HOST=localhost          # or Hostinger's MySQL host (e.g. mysql.hostinger.com)
   DB_USER=u123456789_aylus
   DB_PASSWORD=your_password
   DB_NAME=u123456789_aylus
   DB_PORT=3306
   JWT_SECRET=long-random-string
   ```
4. Tables are auto-created on first `npm run dev` via `backend/db.js:17` (`CREATE TABLE IF NOT EXISTS`). Seed inserts `branch1`/`branch2` if empty.

> Local dev without Hostinger: install MySQL locally (XAMPP/MySQL 8) and point `.env` to `localhost`, or temporarily swap `backend/db.js` for file fallback.

## Run
```bash
# backend (port 4000)
cd backend
npm install
cp .env.example .env  # fill Hostinger credentials
npm run dev           # or npm start

# frontend (port 5173, proxies /api and /uploads to backend)
cd frontend
npm install
npm run dev
```

## Credentials (seeded)
- branch1 / branch1  (branch name = branch1)
- branch2 / branch2

Add 150 branches: `INSERT INTO branches (id,name,username,passwordHash,homeTitle,homeSections) VALUES (...)` — password must be `bcrypt.hashSync('password',10)`, or extend API with a create-branch endpoint.

## API
- `GET /api/branches`, `GET /api/branches/:id`, `PUT /api/branches/:id/home` (auth)
- `POST /api/auth/login`
- `GET /api/branches/:id/posts?limit=50&offset=0`, `GET /api/posts?limit=50&offset=0`, `POST /api/branches/:id/posts` (auth), `PUT .../:postId`, `DELETE .../:postId`
- `POST /api/upload` (auth, field `image`), `GET /api/health` (checks MySQL `SELECT 1`)

Auth: `Authorization: Bearer <jwt>`
