const http = require('node:http');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'quotes.db'));

db.exec(`CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  author TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

if (db.prepare('SELECT COUNT(*) AS n FROM quotes').get().n === 0) {
  const insert = db.prepare('INSERT INTO quotes (text, author) VALUES (?, ?)');
  insert.run('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb');
  insert.run('Simplicity is prerequisite for reliability.', 'Edsger W. Dijkstra');
  insert.run('Well done is better than well said.', 'Benjamin Franklin');
}

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Same quote for everyone all day: hash the UTC date into an index.
function quoteOfTheDay(date = new Date()) {
  const quotes = db.prepare('SELECT id, text, author FROM quotes ORDER BY id').all();
  if (quotes.length === 0) return null;
  const day = date.toISOString().slice(0, 10);
  let hash = 0;
  for (const c of day) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return quotes[hash % quotes.length];
}

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 0 auto; padding: 2rem 1rem; color: #222; background: #fafafa; }
  blockquote { font-size: 1.6rem; line-height: 1.4; margin: 3rem 0 1rem; }
  .author { color: #666; font-style: italic; }
  .date { color: #999; font-size: .9rem; }
  form { display: grid; gap: .5rem; margin: 1.5rem 0; }
  textarea, input, button { font: inherit; padding: .5rem; }
  table { width: 100%; border-collapse: collapse; }
  td { border-top: 1px solid #ddd; padding: .5rem .25rem; vertical-align: top; }
  a { color: #0366d6; }
</style>
</head>
<body>${body}</body>
</html>`;

function renderHome() {
  const q = quoteOfTheDay();
  const today = new Date().toISOString().slice(0, 10);
  const body = q
    ? `<p class="date">${today}</p>
       <blockquote>&ldquo;${escape(q.text)}&rdquo;</blockquote>
       ${q.author ? `<p class="author">&mdash; ${escape(q.author)}</p>` : ''}`
    : '<p>No quotes yet. <a href="/admin">Add one</a>.</p>';
  return page('Quote of the day', body);
}

function renderAdmin(message = '') {
  const quotes = db.prepare('SELECT id, text, author FROM quotes ORDER BY id DESC').all();
  const rows = quotes.map((q) => `<tr>
    <td>${escape(q.text)}</td>
    <td class="author">${escape(q.author)}</td>
    <td><form method="post" action="/admin/delete" style="margin:0">
      <input type="hidden" name="id" value="${q.id}"><button>Delete</button>
    </form></td>
  </tr>`).join('');
  return page('Admin – quotes', `
    <h1>Quotes</h1>
    <p><a href="/">&larr; Back to today's quote</a></p>
    ${message ? `<p><strong>${escape(message)}</strong></p>` : ''}
    <form method="post" action="/admin">
      <textarea name="text" rows="3" placeholder="Quote" required></textarea>
      <input name="author" placeholder="Author (optional)">
      <button>Add quote</button>
    </form>
    <table>${rows}</table>`);
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e5) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(data))));
    req.on('error', reject);
  });
}

function send(res, status, html, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}

const redirect = (res, location) => send(res, 303, '', { Location: location });

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && pathname === '/') return send(res, 200, renderHome());
    if (req.method === 'GET' && pathname === '/admin') return send(res, 200, renderAdmin());

    if (req.method === 'POST' && pathname === '/admin') {
      const { text = '', author = '' } = await readForm(req);
      if (!text.trim()) return send(res, 400, renderAdmin('Quote text is required.'));
      db.prepare('INSERT INTO quotes (text, author) VALUES (?, ?)').run(text.trim(), author.trim() || null);
      return redirect(res, '/admin');
    }

    if (req.method === 'POST' && pathname === '/admin/delete') {
      const { id } = await readForm(req);
      db.prepare('DELETE FROM quotes WHERE id = ?').run(Number(id));
      return redirect(res, '/admin');
    }

    send(res, 404, page('Not found', '<h1>Not found</h1><p><a href="/">Home</a></p>'));
  } catch (err) {
    console.error(err);
    send(res, 500, page('Error', '<h1>Something went wrong</h1>'));
  }
});

server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
