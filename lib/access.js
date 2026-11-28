var crypto = require('node:crypto');

function digest(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function matchesPassword(expected, supplied) {
  return Boolean(expected) && crypto.timingSafeEqual(digest(expected), digest(supplied));
}

exports.requireStaff = function (req, res, next) {
  var header = /^Basic ([A-Za-z0-9+/]+=*)$/i.exec(req.get('Authorization') || '');
  if (header) {
    var credentials = Buffer.from(header[1], 'base64').toString('utf8');
    var separator = credentials.indexOf(':');
    var username = credentials.slice(0, separator);
    var password = credentials.slice(separator + 1);
    var staff = process.env.SHOPLEDGER_STAFF_PASSWORD;
    var admin = process.env.SHOPLEDGER_ADMIN_PASSWORD;
    if (separator > 0 && username === 'admin' && admin !== staff && matchesPassword(admin, password)) {
      req.shopRole = 'admin';
      return next();
    }
    if (separator > 0 && username === 'staff' && matchesPassword(staff, password)) {
      req.shopRole = 'staff';
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="ShopLedger", charset="UTF-8"');
  return res.sendStatus(401);
};

exports.requireAdmin = function (req, res, next) {
  if (req.shopRole !== 'admin') return res.sendStatus(403);
  next();
};
