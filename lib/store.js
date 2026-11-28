var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

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
  var temp = DB_FILE + '.' + crypto.randomUUID() + '.tmp.json';
  var fd = fs.openSync(temp, 'wx');
  try {
    try {
      fs.writeFileSync(fd, JSON.stringify(db, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, DB_FILE);
  } finally {
    fs.rmSync(temp, { force: true });
  }
};

// Hold the lock across read, validation and write, including across processes.
exports.mutation = function (handler, replayable) {
  return function (req, res) {
    var key = replayable && req.get('Idempotency-Key');
    if (key && !/^[\w-]{1,128}$/.test(key)) {
      return res.status(400).json({ error: 'Invalid idempotency key' });
    }

    var lock = DB_FILE + '.lock';
    try {
      fs.mkdirSync(lock);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return res.status(503).json({ error: 'Shop data is busy. Retry shortly.' });
    }

    try {
      var db = exports.read();
      var records = db.submissions || {};
      var scope = req.path + ':' + key;
      var fingerprint = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
      if (key && records[scope]) {
        if (records[scope].fingerprint !== fingerprint) {
          return res.status(409).json({ error: 'This submission key was already used for a different request' });
        }
        return res.status(201).json(records[scope].result);
      }
      return handler(req, res, db, function (result) {
        if (key) {
          records[scope] = { fingerprint: fingerprint, result: result };
          db.submissions = records;
        }
        exports.write(db);
        return res.status(201).json(result);
      });
    } finally {
      fs.rmdirSync(lock);
    }
  };
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
