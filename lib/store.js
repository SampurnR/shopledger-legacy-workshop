var fs = require('fs');
var path = require('path');
var randomUUID = require('node:crypto').randomUUID;

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

function conflict() {
  var error = new Error('The data store changed or is busy. Retry the request.');
  error.code = 'STORE_CONFLICT';
  return error;
}

function createStore(file) {
  var snapshots = new WeakMap();
  var lockFile = file + '.lock';

  function read() {
    var raw = fs.readFileSync(file, 'utf8');
    var db = ensureStructure(JSON.parse(raw));
    snapshots.set(db, raw);
    return db;
  }

  function write(db) {
    var lock;
    try {
      lock = fs.openSync(lockFile, 'wx', 0o600);
    } catch (error) {
      if (error.code === 'EEXIST') throw conflict();
      throw error;
    }

    var staged = file + '.' + randomUUID() + '.tmp';
    try {
      if (fs.readFileSync(file, 'utf8') !== snapshots.get(db)) throw conflict();
      var raw = JSON.stringify(ensureStructure(db), null, 2);
      var output = fs.openSync(staged, 'wx', 0o600);
      try {
        fs.writeFileSync(output, raw);
        fs.fsyncSync(output);
      } finally {
        fs.closeSync(output);
      }
      fs.renameSync(staged, file);
      snapshots.set(db, raw);
    } finally {
      try {
        try {
          fs.unlinkSync(staged);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      } finally {
        fs.closeSync(lock);
        fs.unlinkSync(lockFile);
      }
    }
  }

  return { read: read, write: write };
}

var defaultStore = createStore(DB_FILE);
exports.read = defaultStore.read;
exports.write = defaultStore.write;
exports.createStore = createStore;

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
