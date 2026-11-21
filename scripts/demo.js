'use strict';

// Disposable copies make demonstrations safe even when an operator places orders.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const mode = process.argv[2];
const port = Number(process.argv[3] || (mode === 'before' ? 3001 : 3002));
if (!['before', 'after'].includes(mode) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Usage: node scripts/demo.js before|after [port 1024..65535]');
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const destination = fs.mkdtempSync(path.join(os.tmpdir(), `shopledger-${mode}-`));
const baseline = '68c85a9';
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline], { cwd: root, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(file => /^(lib\/|routes\/|public\/|data\/|server\.js$|config\.js$|package\.json$)/.test(file));

for (const file of files) {
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (mode === 'before') {
    fs.writeFileSync(target, execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root }));
  } else {
    fs.copyFileSync(path.join(root, file), target);
  }
}
console.log(`${mode.toUpperCase()} demo: http://localhost:${port}`);
console.log(`Disposable database: ${path.join(destination, 'data', 'db.json')}`);
console.log('Original checkout database is not served. Stop with Ctrl+C.');
const child = spawn(process.execPath, ['server.js'], {
  cwd: destination,
  env: { ...process.env, PORT: String(port), NODE_PATH: path.join(root, 'node_modules') },
  stdio: 'inherit', windowsHide: true
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
process.on('SIGINT', () => { child.kill(); });
process.on('SIGTERM', () => { child.kill(); });
