var fs = require('fs');
var path = require('path');

var DB_FILE = process.env.SHOPLEDGER_DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

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
  var tempFile = DB_FILE + '.' + process.pid + '.' + Date.now() + '.tmp';
  try {
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), { flag: 'wx' });
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    try { fs.unlinkSync(tempFile); } catch (cleanupError) {}
    throw error;
  }
};

exports.withLock = function (callback) {
  var lockFile = DB_FILE + '.lock';
  var lockFd = null;
  var started = Date.now();
  while (lockFd === null) {
    try {
      lockFd = fs.openSync(lockFile, 'wx');
      fs.writeSync(lockFd, String(process.pid));
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        var owner = parseInt(fs.readFileSync(lockFile, 'utf8'), 10);
        if (owner) {
          try { process.kill(owner, 0); }
          catch (probeError) {
            if (probeError.code === 'ESRCH') fs.unlinkSync(lockFile);
          }
        }
      } catch (readError) {
        if (readError.code === 'ENOENT') continue;
      }
      if (Date.now() - started > 10000) throw new Error('Timed out waiting for the data store lock');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }

  try {
    return callback();
  } finally {
    fs.closeSync(lockFd);
    try { fs.unlinkSync(lockFile); } catch (cleanupError) {}
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
