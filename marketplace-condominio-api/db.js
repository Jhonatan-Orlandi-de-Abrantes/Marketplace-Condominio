const Database = require('better-sqlite3');
const path = require('path');

const dbFile = path.join(__dirname, 'condo.db');
const db = new Database(dbFile);

// Criação das tabelas (se não existirem)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    block TEXT NOT NULL,
    apt TEXT NOT NULL,
    isAdmin INTEGER DEFAULT 0,
    publicProfile INTEGER DEFAULT 0,
    photo TEXT,
    blocked INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT,
    images TEXT, -- JSON string (array de dataURLs ou URLs)
    status TEXT NOT NULL, -- pending | approved | rejected | sold
    rejectionMessage TEXT,
    sold INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    contactPhone TEXT,
    block TEXT,
    apt TEXT,
    commentsCount INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    lastEditAt INTEGER
);

CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    type TEXT NOT NULL, -- create | edit
    date INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    userId TEXT,
    text TEXT NOT NULL,
    date INTEGER NOT NULL,
    status TEXT NOT NULL -- pending | approved | rejected
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    userId TEXT NOT NULL,
    text TEXT NOT NULL,
    date INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_log (
    id TEXT PRIMARY KEY,
    actorAdminId TEXT NOT NULL,
    action TEXT NOT NULL,
    targetId TEXT NOT NULL,
    message TEXT,
    date INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    date INTEGER NOT NULL,
    read INTEGER DEFAULT 0
);
`);

// Categorias padrão (seed)
const hasCategories = db.prepare('SELECT COUNT(*) as c FROM categories').get();
if (hasCategories.c === 0) {
    const insert = db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)');
    ['Eletrodomésticos','Móveis','Serviços','Diversos'].forEach(name => {
        insert.run(crypto.randomUUID(), name);
    });
}

module.exports = db;
