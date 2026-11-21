// Manual HTTP reproduction, separate from the in-memory test suite.
// Copy the app and data before loading server/store; never run the real server.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const root = path.resolve(__dirname, '..');
const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shopledger-ticket1-'));
  for (const name of ['server.js', 'config.js', 'package.json', 'lib', 'routes', 'public', 'data']) {
    fs.cpSync(path.join(root, name), path.join(temp, name), { recursive: true });
  }
  const evidence = path.join(root, 'docs', 'evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const child = spawn(process.execPath, ['-e',
    "const app=require('./server');const s=app.listen(0,'127.0.0.1',()=>console.log(s.address().port));"],
    { cwd: temp, env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server start timeout: ' + errors)), 10000);
      child.stdout.once('data', chunk => { clearTimeout(timer); resolve(Number(String(chunk).trim())); });
      child.once('error', reject);
      child.once('exit', code => { if (code) { clearTimeout(timer); reject(new Error(errors)); } });
    });
    const base = 'http://127.0.0.1:' + port;
    async function get(url) {
      const res = await fetch(base + url);
      if (!res.ok) throw new Error(url + ': HTTP ' + res.status);
      return res;
    }
    const report = await (await get('/api/reports/gst-reconciliation')).json();
    const invoices = [];
    for (const row of report.rows) {
      const html = await (await get('/orders/' + row.orderId + '/invoice')).text();
      invoices.push({ orderId: row.orderId, notice: html.includes('Accountant Reconciliation Notice:') });
      if (row.orderId === 1002) fs.writeFileSync(path.join(evidence, 'cp4-' + phase + '-invoice-1002.html'), html);
    }
    const post = await fetch(base + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ id: 1, qty: 1 }, { id: 4, qty: 2 }], coupon: 'SAVE10', customer: 'Workshop fixture', paymentMode: 'cash' }) });
    const order = await post.json();
    if (post.status !== 201) throw new Error(JSON.stringify(order));
    const newHtml = await (await get('/orders/' + order.id + '/invoice')).text();
    const result = { phase, temporaryProject: temp, baseUrlDuringRun: base, totalChecked: report.totalChecked,
      mismatchCount: report.mismatchCount, totalDelta: report.totalDelta,
      rows: report.rows.map(({ customer, ...row }) => row), invoicePages: invoices,
      newOrder: { status: post.status, id: order.id, discount: order.discount, tax: order.tax, total: order.total,
        invoiceMismatchNotice: newHtml.includes('Accountant Reconciliation Notice:') } };
    fs.writeFileSync(path.join(evidence, 'cp4-' + phase + '-http.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    if (report.totalChecked !== 8 || report.mismatchCount !== (phase === 'before' ? 7 : 0)) throw new Error('Unexpected reconciliation');
    if (order.total !== 963.9 || order.tax !== 45.9 || order.discount !== 102) throw new Error('Checkout changed');
    if (result.newOrder.invoiceMismatchNotice !== (phase === 'before')) throw new Error('Unexpected new invoice');
  } finally {
    const closed = once(child, 'exit');
    child.kill();
    await closed;
    console.log('Temporary app stopped. Temporary copy retained for evidence; tracked data was not loaded by the server.');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
