-- Run this once if you prefer manual setup (phpMyAdmin or mysql CLI):
-- mysql -u root -e "SOURCE init-local-db.sql"
CREATE DATABASE IF NOT EXISTS aylus_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Tables are auto-created by backend/db.js:initDb() on first npm run dev
