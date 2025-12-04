require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // permite imagens em base64

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Sem token' });
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

function adminMiddleware(req, res, next) {
    const u = db.prepare('SELECT isAdmin FROM users WHERE id = ?').get(req.userId);
    if (!u || !u.isAdmin) return res.status(403).json({ error: 'Acesso admin negado' });
    next();
}

// Auth
app.post('/register', (req, res) => {
    const { name, email, password, phone, block, apt } = req.body;
    if (!name || !email || !password || !block || !apt) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' });
    const hash = bcrypt.hashSync(password, 10);
    const id = crypto.randomUUID();
    db.prepare(`
        INSERT INTO users (id, name, email, password, phone, block, apt, isAdmin, publicProfile, blocked, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
    `).run(id, name, email.toLowerCase(), hash, phone || '', block, apt, Date.now());
    const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
    if (user.blocked) return res.status(403).json({ error: 'Conta bloqueada' });
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, name: user.name, isAdmin: !!user.isAdmin } });
});

// Perfil
app.get('/me', authMiddleware, (req, res) => {
    const u = db.prepare('SELECT id,name,email,phone,block,apt,isAdmin,publicProfile,photo FROM users WHERE id = ?').get(req.userId);
    res.json(u);
});
app.patch('/me', authMiddleware, (req, res) => {
    const { phone, block, apt, publicProfile, photo } = req.body;
    if (!block || !apt) return res.status(400).json({ error: 'Bloco e apt são obrigatórios' });
    db.prepare('UPDATE users SET phone=?, block=?, apt=?, publicProfile=?, photo=? WHERE id=?')
        .run(phone || '', block, apt, publicProfile ? 1 : 0, photo || null, req.userId);
    res.json({ ok: true });
});
app.post('/logout', authMiddleware, (req, res) => {
    // Com JWT não há sessão no servidor; o cliente apenas descarta o token.
    res.json({ ok: true });
});

// Categorias
app.get('/categories', (req, res) => {
    const cats = db.prepare('SELECT name FROM categories ORDER BY name ASC').all();
    res.json(cats.map(c => c.name));
});
app.post('/categories', authMiddleware, adminMiddleware, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    try {
        db.prepare('INSERT INTO categories (id, name) VALUES (?, ?)').run(crypto.randomUUID(), name);
        res.json({ ok: true });
    } catch {
        res.status(409).json({ error: 'Categoria já existe' });
    }
});
app.delete('/categories/:name', authMiddleware, adminMiddleware, (req, res) => {
    db.prepare('DELETE FROM categories WHERE name = ?').run(req.params.name);
    res.json({ ok: true });
});

// Produtos (criar pedido)
app.post('/products', authMiddleware, (req, res) => {
    const { title, description, price, category, images } = req.body;
    if (!title || !description || !price || !images || images.length < 3 || images.length > 5) {
        return res.status(400).json({ error: 'Campos inválidos/limite de imagens' });
    }
    const id = crypto.randomUUID();
    db.prepare(`
        INSERT INTO products (id, userId, title, description, price, category, images, status, sold, deleted, contactPhone, block, apt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, (SELECT phone FROM users WHERE id=?), (SELECT block FROM users WHERE id=?), (SELECT apt FROM users WHERE id=?), ?)
    `).run(id, req.userId, title, description, price, category || null, JSON.stringify(images), req.userId, req.userId, req.userId, Date.now());
    db.prepare('INSERT INTO requests (id, productId, type, date) VALUES (?, ?, ?, ?)').run(crypto.randomUUID(), id, 'create', Date.now());
    res.json({ ok: true, productId: id });
});

// Listar produtos aprovados
app.get('/products', (req, res) => {
    const { q, category, offset = 0, limit = 24 } = req.query;
    let sql = 'SELECT id,title,price,category,images,sold FROM products WHERE status="approved" AND deleted=0';
    const params = [];
    if (q) { sql += ' AND lower(title) LIKE ?'; params.push(`%${String(q).toLowerCase()}%`); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(r => ({ ...r, images: JSON.parse(r.images || '[]') })));
});

// Detalhe do produto
app.get('/products/:id', (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND deleted=0').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    p.images = JSON.parse(p.images || '[]');
    res.json(p);
});

// Comentários
app.post('/products/:id/comments', authMiddleware, (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Texto obrigatório' });
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO comments (id, productId, userId, text, date) VALUES (?, ?, ?, ?, ?)')
        .run(id, req.params.id, req.userId, text, Date.now());
    db.prepare('UPDATE products SET commentsCount = commentsCount + 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true, id });
});

app.get('/products/:id/comments', (req, res) => {
    const rows = db.prepare('SELECT c.*, u.name FROM comments c JOIN users u ON u.id = c.userId WHERE productId = ? ORDER BY date DESC').all(req.params.id);
    res.json(rows);
});

// Denúncias
app.post('/products/:id/reports', authMiddleware, (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Motivo obrigatório' });
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO reports (id, productId, userId, text, date, status) VALUES (?, ?, ?, ?, ?, "pending")')
        .run(id, req.params.id, req.userId, text, Date.now());
    res.json({ ok: true, id });
});

// Admin: fila de pedidos e denúncias
app.get('/admin/requests', authMiddleware, adminMiddleware, (req, res) => {
    const rows = db.prepare('SELECT * FROM requests ORDER BY date ASC').all();
    res.json(rows);
});

app.get('/admin/reports', authMiddleware, adminMiddleware, (req, res) => {
    const rows = db.prepare('SELECT * FROM reports ORDER BY date ASC').all();
    res.json(rows);
});

app.post('/admin/requests/:id/approve', authMiddleware, adminMiddleware, (req, res) => {
    const r = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Pedido não encontrado' });
    db.prepare('UPDATE products SET status="approved" WHERE id = ?').run(r.productId);
    db.prepare('DELETE FROM requests WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO admin_log (id, actorAdminId, action, targetId, message, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), req.userId, 'approve_product', r.productId, '', Date.now());
    res.json({ ok: true });
});

app.post('/admin/requests/:id/reject', authMiddleware, adminMiddleware, (req, res) => {
    const { message = 'Sem motivo.' } = req.body;
    const r = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Pedido não encontrado' });
    db.prepare('UPDATE products SET status="rejected", rejectionMessage=? WHERE id = ?').run(message, r.productId);
    db.prepare('DELETE FROM requests WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO admin_log (id, actorAdminId, action, targetId, message, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), req.userId, 'reject_product', r.productId, message, Date.now());
    res.json({ ok: true });
});

app.post('/admin/reports/:id/approve', authMiddleware, adminMiddleware, (req, res) => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Denúncia não encontrada' });
    db.prepare('UPDATE reports SET status="approved" WHERE id = ?').run(req.params.id);

    // Bloqueio por múltiplas denúncias aprovadas (ex.: >=3)
    const count = db.prepare('SELECT COUNT(*) as c FROM reports WHERE productId = ? AND status="approved"').get(r.productId).c;
    if (count >= 3) {
        const p = db.prepare('SELECT userId FROM products WHERE id = ?').get(r.productId);
        if (p) {
            db.prepare('UPDATE users SET blocked=1 WHERE id = ?').run(p.userId);
            db.prepare('INSERT INTO admin_log (id, actorAdminId, action, targetId, message, date) VALUES (?, ?, ?, ?, ?, ?)')
                .run(crypto.randomUUID(), req.userId, 'block_user', p.userId, 'Múltiplas denúncias aprovadas.', Date.now());
        }
    }
    db.prepare('INSERT INTO admin_log (id, actorAdminId, action, targetId, message, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), req.userId, 'approve_report', req.params.id, '', Date.now());
    res.json({ ok: true });
});

app.post('/admin/reports/:id/reject', authMiddleware, adminMiddleware, (req, res) => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Denúncia não encontrada' });
    db.prepare('UPDATE reports SET status="rejected" WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO admin_log (id, actorAdminId, action, targetId, message, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), req.userId, 'reject_report', req.params.id, '', Date.now());
    res.json({ ok: true });
});

// Admin: promover/remover admin
app.post('/admin/users/:id/promote', authMiddleware, adminMiddleware, (req, res) => {
    if (req.params.id === req.userId) return res.status(400).json({ error: 'Não pode alterar a si mesmo' });
    db.prepare('UPDATE users SET isAdmin=1 WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO admin_log (id, actorAdminId, action, targetId, message, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), req.userId, 'promote', req.params.id, '', Date.now());
    res.json({ ok: true });
});
app.post('/admin/users/:id/demote', authMiddleware, adminMiddleware, (req, res) => {
    if (req.params.id === req.userId) return res.status(400).json({ error: 'Não pode alterar a si mesmo' });
    db.prepare('UPDATE users SET isAdmin=0 WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO admin_log (id, actorAdminId, action, targetId, message, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), req.userId, 'demote', req.params.id, '', Date.now());
    res.json({ ok: true });
});

// Histórico admin
app.get('/admin/log', authMiddleware, adminMiddleware, (req, res) => {
    const rows = db.prepare('SELECT * FROM admin_log ORDER BY date DESC').all();
    res.json(rows);
});

// Marcar como vendido
app.post('/products/:id/sold', authMiddleware, (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!p || p.userId !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
    db.prepare('UPDATE products SET sold=1, status="sold" WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('API rodando na porta', PORT));
