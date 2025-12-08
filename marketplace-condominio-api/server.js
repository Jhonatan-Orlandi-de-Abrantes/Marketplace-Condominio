const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '20mb' }));

function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = {
            users: [],
            products: [],
            categories: [],
            comments: [],
            reports: [],
            commentReports: [],
            adminLog: [],
            notifications: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

app.get('/users', (req, res) => {
    const db = readDB();
    res.json(db.users || []);
});

app.get('/users/:id', (req, res) => {
    const id = req.params.id;
    const db = readDB();
    db.users = db.users || [];
    const user = db.users.find(u => String(u.id) === String(id));
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
});

app.put('/users/:id', (req, res) => {
    const id = req.params.id;
    const db = readDB();
    db.users = db.users || [];
    const idx = db.users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Replace user object but preserve id if not provided
    const incoming = req.body || {};
    const existing = db.users[idx];
    const newUser = { ...existing, ...incoming, id: existing.id };
    db.users[idx] = newUser;

    // log admin change if present
    db.adminLog = db.adminLog || [];
    if (typeof incoming.isAdmin !== 'undefined' && incoming.isAdmin !== existing.isAdmin) {
        db.adminLog.unshift({
            action: incoming.isAdmin ? 'promote_admin' : 'demote_admin',
            userId: existing.id,
            date: Date.now()
        });
    }

    writeDB(db);
    res.json({ ok: true, user: newUser });
});

app.patch('/users/:id', (req, res) => {
    const id = req.params.id;
    const db = readDB();
    db.users = db.users || [];
    const idx = db.users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    const existing = db.users[idx];
    const incoming = req.body || {};

    // update allowed fields (merge)
    const allowed = ['name', 'email', 'password', 'phone', 'block', 'apt', 'publicProfile', 'isAdmin'];
    allowed.forEach(k => {
        if (typeof incoming[k] !== 'undefined') existing[k] = incoming[k];
    });

    // log admin change if present
    db.adminLog = db.adminLog || [];
    if (typeof incoming.isAdmin !== 'undefined' && incoming.isAdmin !== existing.isAdmin) {
        db.adminLog.unshift({
            action: incoming.isAdmin ? 'promote_admin' : 'demote_admin',
            userId: existing.id,
            date: Date.now()
        });
    }

    db.users[idx] = existing;
    writeDB(db);
    res.json({ ok: true, user: existing });
});

app.post('/users/:id/admin', (req, res) => {
    const id = req.params.id;
    const { isAdmin } = req.body;
    if (typeof isAdmin === 'undefined') return res.status(400).json({ error: 'isAdmin obrigatório' });

    const db = readDB();
    db.users = db.users || [];
    const idx = db.users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    const user = db.users[idx];
    const prev = !!user.isAdmin;
    user.isAdmin = !!isAdmin;

    db.adminLog = db.adminLog || [];
    if (prev !== user.isAdmin) {
        db.adminLog.unshift({
            action: user.isAdmin ? 'promote_admin' : 'demote_admin',
            userId: user.id,
            date: Date.now()
        });
    }

    db.users[idx] = user;
    writeDB(db);
    res.json({ ok: true, user });
});

app.post('/users/admin', (req, res) => {
    const { id, isAdmin } = req.body;
    if (!id || typeof isAdmin === 'undefined') return res.status(400).json({ error: 'id e isAdmin obrigatórios' });

    const db = readDB();
    db.users = db.users || [];
    const idx = db.users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    const user = db.users[idx];
    const prev = !!user.isAdmin;
    user.isAdmin = !!isAdmin;

    db.adminLog = db.adminLog || [];
    if (prev !== user.isAdmin) {
        db.adminLog.unshift({
            action: user.isAdmin ? 'promote_admin' : 'demote_admin',
            userId: user.id,
            date: Date.now()
        });
    }

    db.users[idx] = user;
    writeDB(db);
    res.json({ ok: true, user });
});

app.post('/register', (req, res) => {
    const { name, email, password, phone, block, apt } = req.body;
    if (!name || !email || !password || !phone || !block || !apt) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    const digits = String(phone).replace(/\D/g, '');
    if (!/^\d{11}$/.test(digits)) {
        return res.status(400).json({ error: 'Telefone inválido. Use DDD + número (11 dígitos).' });
    }
    const db = readDB();
    db.users = db.users || [];
    if (db.users.find(u => u.email === email)) return res.status(409).json({ error: 'E-mail já cadastrado' });
    const newUser = { id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, name, email, password, phone: digits, block, apt, isAdmin: false, publicProfile: false, createdAt: Date.now() };
    db.users.push(newUser);
    writeDB(db);
    res.json({ ok: true, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
});

app.get('/categories', (req, res) => {
    const db = readDB();
    res.json(db.categories || []);
});

app.delete('/categories/:name', (req, res) => {
    const name = req.params.name;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

    const db = readDB();
    db.categories = db.categories || [];
    const idx = db.categories.indexOf(name);
    if (idx === -1) return res.status(404).json({ error: 'Categoria não encontrada' });

    db.categories.splice(idx, 1);

    const fallback = 'Sem categoria';
    if (!db.categories.includes(fallback)) db.categories.push(fallback);

    db.products = db.products || [];
    const affected = db.products.filter(p => p.category === name);

    if (affected.length) {
        db.notifications = db.notifications || [];
        db.adminLog = db.adminLog || [];

        const ownersNotified = new Set();

        affected.forEach(prod => {
            prod.category = fallback;
            if (!ownersNotified.has(prod.userId)) {
                ownersNotified.add(prod.userId);
            }
            db.adminLog.unshift({
                action: 'category_reassigned',
                productId: prod.id,
                oldCategory: name,
                newCategory: fallback,
                date: Date.now()
            });
        });

        const users = db.users || [];
        ownersNotified.forEach(userId => {
            const owner = users.find(u => u.id === userId);
            const note = {
                userId,
                type: 'category_changed',
                title: 'Categoria do produto alterada',
                message: `A categoria de um ou mais dos seus produtos foi alterada de "${name}" para "${fallback}" porque a categoria foi removida pelo admin. Por favor, verifique e atualize se necessário.`,
                date: Date.now(),
                read: false
            };
            db.notifications.push(note);
        });
    } else {
        db.adminLog = db.adminLog || [];
        db.adminLog.unshift({ action: 'category_deleted', category: name, date: Date.now() });
    }

    writeDB(db);
    res.json({ ok: true, reassigned: affected.length, fallback });
});

app.get('/products', (req, res) => {
    const db = readDB();
    res.json(db.products || []);
});
app.post('/products', (req, res) => {
    const { id, userId, title, description, price, category, images } = req.body;
    if (!userId || !title || !description || typeof price !== 'number' || !category) return res.status(400).json({ error: 'Dados obrigatórios faltando' });
    const db = readDB();
    db.products = db.products || [];
    const newProduct = { id: id || `${Date.now()}`, userId, title, description, price, category, images: images || [], status: req.body.status || 'pendente', sold: !!req.body.sold, deleted: !!req.body.deleted, contactPhone: req.body.contactPhone || null, block: req.body.block || null, apt: req.body.apt || null, comments: req.body.comments || [], createdAt: Date.now() };
    db.products.push(newProduct);
    writeDB(db);
    res.json({ ok: true, product: newProduct });
});
app.post('/products/approve', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID obrigatório' });
    const db = readDB();
    db.products = db.products || [];
    const p = db.products.find(x => x.id === id);
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    p.status = 'aprovado';
    db.adminLog = db.adminLog || [];
    db.adminLog.unshift({ action: 'approve', productId: id, date: Date.now() });
    writeDB(db);
    res.json({ ok: true, product: p });
});
app.post('/products/reject', (req, res) => {
    const { id, reason } = req.body;
    if (!id) return res.status(400).json({ error: 'ID obrigatório' });
    const db = readDB();
    db.products = db.products || [];
    const p = db.products.find(x => x.id === id);
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    p.status = 'rejeitado';
    p.rejectionMessage = reason || 'Rejeitado pelo admin';
    db.adminLog = db.adminLog || [];
    db.adminLog.unshift({ action: 'reject', productId: id, reason: p.rejectionMessage, date: Date.now() });
    writeDB(db);
    res.json({ ok: true, product: p });
});
app.post('/products/delete', (req, res) => {
    const { id, reason } = req.body;
    if (!id) return res.status(400).json({ error: 'ID obrigatório' });
    const db = readDB();
    db.products = db.products || [];
    const idx = db.products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado' });
    const removed = db.products.splice(idx, 1)[0];
    db.adminLog = db.adminLog || [];
    db.adminLog.unshift({ action: 'delete', productId: id, reason: reason || 'Removido pelo admin', date: Date.now() });
    db.notifications = db.notifications || [];
    db.notifications.push({ userId: removed.userId, type: 'product_deleted', productId: id, reason: reason || '', date: Date.now(), read: false });
    writeDB(db);
    res.json({ ok: true });
});
app.post('/products/delete-by-owner', (req, res) => {
    const { id, userId } = req.body;
    if (!id || !userId) return res.status(400).json({ error: 'ID e userId obrigatórios' });
    const db = readDB();
    db.products = db.products || [];
    const idx = db.products.findIndex(p => p.id === id && p.userId === userId);
    if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado ou sem permissão' });
    const removed = db.products.splice(idx, 1)[0];
    db.adminLog = db.adminLog || [];
    db.adminLog.unshift({ action: 'owner_delete', productId: id, userId, date: Date.now() });
    writeDB(db);
    res.json({ ok: true });
});

app.get('/comments', (req, res) => {
    const db = readDB();
    const productId = req.query.productId;
    const comments = (db.comments || []).filter(c => !productId || c.productId === productId);
    res.json(comments);
});
app.post('/comments', (req, res) => {
    const { productId, userId, userName, text, createdAt } = req.body;
    if (!productId || !text) return res.status(400).json({ error: 'Dados inválidos' });
    const db = readDB();
    db.comments = db.comments || [];
    db.comments.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, productId, userId: userId || null, userName: userName || 'Usuário', text, createdAt: createdAt || Date.now() });
    writeDB(db);
    res.json({ ok: true });
});
app.delete('/comments/:id', (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'ID obrigatório' });
    const db = readDB();
    db.comments = db.comments || [];
    const idx = db.comments.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Comentário não encontrado' });
    const removed = db.comments.splice(idx, 1)[0];
    db.adminLog = db.adminLog || [];
    db.adminLog.unshift({ action: 'delete_comment', commentId: id, userId: removed.userId, date: Date.now() });
    writeDB(db);
    res.json({ ok: true });
});

app.get('/reports', (req, res) => {
    const db = readDB();
    res.json(db.reports || []);
});
app.post('/reports', (req, res) => {
    const { productId, userId, text, createdAt } = req.body;
    if (!productId || !text) return res.status(400).json({ error: 'Dados inválidos' });
    const db = readDB();
    db.reports = db.reports || [];
    db.reports.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, productId, userId: userId || null, text, createdAt: createdAt || Date.now(), handled: false });
    writeDB(db);
    res.json({ ok: true });
});
app.post('/reports/resolve', (req, res) => {
    const { reportId, action, note } = req.body;
    if (!reportId) return res.status(400).json({ error: 'reportId obrigatório' });
    const db = readDB();
    db.reports = db.reports || [];
    const r = db.reports.find(x => x.id === reportId);
    if (!r) return res.status(404).json({ error: 'Denúncia não encontrada' });
    r.handled = true;
    r.handledAt = Date.now();
    r.handledAction = action || 'resolved';
    r.handledNote = note || '';
    writeDB(db);
    res.json({ ok: true, report: r });
});

app.post('/comment-reports', (req, res) => {
    const { commentId, userId, text, createdAt } = req.body;
    if (!commentId || !text) return res.status(400).json({ error: 'Dados inválidos' });
    const db = readDB();
    db.commentReports = db.commentReports || [];
    db.commentReports.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, commentId, userId: userId || null, text, createdAt: createdAt || Date.now(), handled: false });
    writeDB(db);
    res.json({ ok: true });
});
app.get('/comment-reports', (req, res) => {
    const db = readDB();
    res.json(db.commentReports || []);
});
app.post('/comment-reports/resolve', (req, res) => {
    const { reportId, action, note } = req.body;
    if (!reportId) return res.status(400).json({ error: 'reportId obrigatório' });
    const db = readDB();
    db.commentReports = db.commentReports || [];
    const r = db.commentReports.find(x => x.id === reportId);
    if (!r) return res.status(404).json({ error: 'Denúncia não encontrada' });
    r.handled = true;
    r.handledAt = Date.now();
    r.handledAction = action || 'resolved';
    r.handledNote = note || '';
    writeDB(db);
    res.json({ ok: true, report: r });
});

app.get('/admin/log', (req, res) => {
    const db = readDB();
    res.json(db.adminLog || []);
});

app.get('/notifications', (req, res) => {
    const db = readDB();
    res.json(db.notifications || []);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
