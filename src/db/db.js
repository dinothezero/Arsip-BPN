'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'arsip-bpn.db');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session-secret');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

function getSessionSecret() {
  if (fs.existsSync(SESSION_SECRET_FILE)) {
    return fs.readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
  }
  const secret = require('crypto').randomBytes(48).toString('hex');
  fs.writeFileSync(SESSION_SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

module.exports = { db, DATA_DIR, DB_PATH, UPLOAD_DIR, getSessionSecret };