var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

function ensureStructure(db) {
  if (!db.products) db.products = [];
  if (!db.orders) db.orders = [];
  if (!db.customers) db.customers = [];
  if (!db.settlements) db.settlements = [];
  if (!db.auditLog) db.auditLog = [];
  if (!db.nextOrderId) db.nextOrderId = 1001;
  if (!db.nextSettlementId) db.nextSettlementId = 501;
  return db;
}

exports.read = function () {
  var raw = fs.readFileSync(DB_FILE, 'utf8');
  var parsed = JSON.parse(raw);
  return ensureStructure(parsed);
};

exports.write = function (db) {
  ensureStructure(db);
  var snapshot = JSON.stringify(db, null, 2);
  var target = DB_FILE;
  var mode;
  try {
    // Replace the data file itself when the configured path is a symlink.
    target = fs.realpathSync(DB_FILE);
    mode = fs.statSync(target).mode & 0o777;
  } catch (error) {
    if (error.code !== 'ENOENT' || fs.lstatSync(DB_FILE, { throwIfNoEntry: false })) throw error;
  }

  var temporary = target + '.' + crypto.randomBytes(12).toString('hex') + '.tmp.json';
  var staged = false;
  try {
    fs.writeFileSync(temporary, snapshot, { flag: 'wx', mode: 0o600, flush: true });
    staged = true;
    if (mode != null) fs.chmodSync(temporary, mode);
    fs.renameSync(temporary, target);
  } catch (error) {
    if (staged || error.code !== 'EEXIST') {
      try {
        fs.unlinkSync(temporary);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') error.cleanupError = cleanupError;
      }
    }
    throw error;
  }
};

exports.appendAudit = function (db, action, details) {
  if (!db.auditLog) db.auditLog = [];
  db.auditLog.unshift({
    ts: new Date().toISOString(),
    action: action,
    details: details || ''
  });
  if (db.auditLog.length > 100) {
    db.auditLog = db.auditLog.slice(0, 100);
  }
};
