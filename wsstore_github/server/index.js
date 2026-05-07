const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'db.json');
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin1234';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use(express.static(path.join(__dirname, '../public')));

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const seed = {
      products: [
        { id: '1', name: 'Classic White Tee', category: 'T-Shirts', desc: 'Premium cotton oversized fit. Clean, minimal, essential.', price: 35, currency: 'USD', badge: 'New', available: true, image: '', createdAt: Date.now() },
        { id: '2', name: 'Black Cargo Pants', category: 'Bottoms', desc: 'Heavy duty cargo with 6 pockets. Streetwear ready.', price: 80, currency: 'USD', badge: 'Hot', available: true, image: '', createdAt: Date.now() }
      ],
      activities: [],
      comments: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function log(action, detail, ip) {
  const db = readDB();
  db.activities.unshift({ id: crypto.randomUUID(), action, detail, ip: ip || '—', ts: Date.now() });
  if (db.activities.length > 300) db.activities = db.activities.slice(0, 300);
  writeDB(db);
}

function auth(req, res, next) {
  if (req.headers['x-admin-token'] !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/api/products', (req, res) => res.json(readDB().products));
app.get('/api/comments/:pid', (req, res) => res.json(readDB().comments.filter(c => c.productId === req.params.pid)));

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASS) res.json({ token: ADMIN_PASS, ok: true });
  else res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/admin/products', auth, (req, res) => res.json(readDB().products));
app.get('/api/admin/activities', auth, (req, res) => res.json(readDB().activities));

app.post('/api/admin/products', auth, (req, res) => {
  const db = readDB();
  const p = {
    id: crypto.randomUUID(),
    name: req.body.name || 'Unnamed',
    category: req.body.category || 'General',
    desc: req.body.desc || '',
    price: parseFloat(req.body.price) || 0,
    currency: req.body.currency || 'USD',
    badge: req.body.badge || '',
    available: req.body.available !== false,
    image: req.body.image || '',
    createdAt: Date.now()
  };
  db.products.push(p);
  writeDB(db);
  log('ADD', `Added: ${p.name} @ ${p.price} ${p.currency}`, req.ip);
  res.json(p);
});

app.put('/api/admin/products/:id', auth, (req, res) => {
  const db = readDB();
  const i = db.products.findIndex(p => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  db.products[i] = { ...db.products[i], ...req.body, id: db.products[i].id, createdAt: db.products[i].createdAt };
  writeDB(db);
  log('EDIT', `Edited: ${db.products[i].name} — ${db.products[i].price} ${db.products[i].currency}`, req.ip);
  res.json(db.products[i]);
});

app.delete('/api/admin/products/:id', auth, (req, res) => {
  const db = readDB();
  const p = db.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  db.products = db.products.filter(x => x.id !== req.params.id);
  writeDB(db);
  log('DELETE', `Deleted: ${p.name}`, req.ip);
  res.json({ ok: true });
});

app.post('/api/admin/comments', auth, (req, res) => {
  const db = readDB();
  const c = { id: crypto.randomUUID(), productId: req.body.productId, text: req.body.text, ts: Date.now() };
  db.comments.unshift(c);
  writeDB(db);
  log('NOTE', `Note on "${req.body.productId}": ${req.body.text}`, req.ip);
  res.json(c);
});

app.delete('/api/admin/comments/:id', auth, (req, res) => {
  const db = readDB();
  db.comments = db.comments.filter(c => c.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`✅ WS Store running → http://localhost:${PORT}`));
