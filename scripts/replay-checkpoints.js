'use strict';

// Reconstruct the recorded test-first sequence without a database or dependencies.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shopledger-checkpoints-'));
const copy = (from, to) => fs.cpSync(path.join(root, from), path.join(temp, to), { recursive: true });

function run(label, files, expectedStatus) {
  console.log('\n' + '='.repeat(72) + '\n' + label);
  console.log('node --test ' + files.join(' '));
  const env = { ...process.env, FORCE_COLOR: '1' };
  delete env.NO_COLOR;
  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: temp, encoding: 'utf8', env
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  if (result.status !== expectedStatus) {
    throw new Error(label + ': expected exit ' + expectedStatus + ', got ' + result.status);
  }
}

try {
  copy('lib', 'lib');
  copy('config.js', 'config.js');
  copy('fixtures', 'fixtures');
  fs.mkdirSync(path.join(temp, 'test'));
  copy('docs/evidence/invoice.before.js.txt', 'lib/invoice.js');
  copy('docs/evidence/characterization.before.js.txt', 'test/invoice.characterization.test.js');
  console.log('Checkpoint replay: isolated temporary folder, no data/ directory.');
  run('CP3 - original behavior: 14 tests should PASS', ['test/invoice.characterization.test.js'], 0);
  copy('test/invoice.regression.test.js', 'test/invoice.regression.test.js');
  run('CP4 RED - original invoice: 20 regression failures EXPECTED', ['test/invoice.regression.test.js'], 1);
  copy('lib/invoice.js', 'lib/invoice.js');
  copy('test/invoice.characterization.test.js', 'test/invoice.characterization.test.js');
  run('CP4 GREEN - fixed invoice: all 37 tests should PASS', [], 0);
  console.log('\nReplay verified: characterization PASS -> regression FAIL -> fixed suite PASS.');
} finally {
  // Only the fresh, script-owned test directory is removed.
  fs.rmSync(temp, { recursive: true, force: true });
}
