var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var fs = require('node:fs');
var path = require('node:path');

// Read the real database only to prove integrity; never parse or use it as a fixture.
function fingerprint() {
  var file = path.join(__dirname, '../../data/db.json');
  return {
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    mtimeNs: fs.statSync(file, { bigint: true }).mtimeNs
  };
}

exports.guard = function (t) {
  var before = fingerprint();
  t.after(function () {
    assert.deepEqual(fingerprint(), before, 'real database bytes and mtime must remain unchanged');
  });
};
