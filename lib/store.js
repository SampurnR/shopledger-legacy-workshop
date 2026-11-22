var fs = require('fs');
var path = require('path');
var randomUUID = require('crypto').randomUUID;

var DB_FILE = process.env.SHOPLEDGER_DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
var LOCK_FILE = DB_FILE + '.lock';
var snapshots = new WeakMap();

function conflict() {
  var error = new Error('Another update is in progress or has already changed the store. Please retry.');
  error.code = 'STORE_CONFLICT';
  return error;
}

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
  var db = ensureStructure(JSON.parse(raw));
  snapshots.set(db, raw);
  return db;
};

exports.write = function (db) {
  var lock;
  try {
    lock = fs.openSync(LOCK_FILE, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw conflict();
    throw error;
  }

  var temp = DB_FILE + '.' + randomUUID() + '.tmp.json';
  var tempCreated = false;
  try {
    fs.writeFileSync(lock, String(process.pid), 'utf8');
    if (fs.readFileSync(DB_FILE, 'utf8') !== snapshots.get(db)) throw conflict();
    var contents = JSON.stringify(ensureStructure(db), null, 2);
    var file = fs.openSync(temp, 'wx', fs.statSync(DB_FILE).mode & 0o777);
    tempCreated = true;
    try {
      fs.writeFileSync(file, contents, 'utf8');
      fs.fsyncSync(file);
    } finally {
      fs.closeSync(file);
    }
    fs.renameSync(temp, DB_FILE);
    tempCreated = false;
    snapshots.set(db, contents);
  } finally {
    try {
      if (tempCreated) fs.unlinkSync(temp);
    } finally {
      fs.closeSync(lock);
      fs.unlinkSync(LOCK_FILE);
    }
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
