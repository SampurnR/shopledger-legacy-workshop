// Date utilities for ShopLedger (Indian DD/MM/YYYY format)

function pad2(n) {
  return ('0' + n).slice(-2);
}

exports.today = function () {
  var d = new Date();
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
};

function isValidCalendarDate(y, m, d) {
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return false;
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  var dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

exports.toComparableDate = function (input) {
  if (input == null) return '';
  var s = String(input).trim();
  if (!s) return '';

  var p, y, m, d;
  if (s.indexOf('/') !== -1) {
    p = s.split('/');
    if (p.length !== 3) return '';
    var dStr = p[0].trim();
    var mStr = p[1].trim();
    var yStr = p[2].trim();
    if (!/^\d{1,2}$/.test(dStr) || !/^\d{1,2}$/.test(mStr) || !/^(\d{2}|\d{4})$/.test(yStr)) {
      return '';
    }
    d = parseInt(dStr, 10);
    m = parseInt(mStr, 10);
    y = yStr.length === 2 ? 2000 + parseInt(yStr, 10) : parseInt(yStr, 10);
    if (!isValidCalendarDate(y, m, d)) return '';
    return String(y) + '-' + pad2(m) + '-' + pad2(d);
  }

  if (s.indexOf('-') !== -1) {
    p = s.split('-');
    if (p.length !== 3) return '';
    var a = p[0].trim();
    var b = p[1].trim();
    var c = p[2].trim();
    if (a.length <= 2 && c.length === 4) {
      if (!/^\d{1,2}$/.test(a) || !/^\d{1,2}$/.test(b) || !/^\d{4}$/.test(c)) return '';
      d = parseInt(a, 10);
      m = parseInt(b, 10);
      y = parseInt(c, 10);
    } else {
      if (!/^(\d{2}|\d{4})$/.test(a) || !/^\d{1,2}$/.test(b) || !/^\d{1,2}$/.test(c)) return '';
      y = a.length === 2 ? 2000 + parseInt(a, 10) : parseInt(a, 10);
      m = parseInt(b, 10);
      d = parseInt(c, 10);
    }
    if (!isValidCalendarDate(y, m, d)) return '';
    return String(y) + '-' + pad2(m) + '-' + pad2(d);
  }

  return '';
};

exports.compareDates = function (a, b) {
  var ka = exports.toComparableDate(a);
  var kb = exports.toComparableDate(b);
  if (ka === kb) return 0;
  if (!ka) return -1;
  if (!kb) return 1;
  return ka < kb ? -1 : 1;
};

// Added for date-picker filtering (Vikram, Oct 2021)
// Accepts either DD/MM/YYYY or YYYY-MM-DD and normalizes to YYYY-MM-DD for comparison and sorting
exports.normalizeDateKey = function (str) {
  return exports.toComparableDate(str);
};

exports.getFiscalYear = function (dateStr) {
  var s = exports.normalizeDateKey(dateStr);
  var parts = s.split('-');
  if (parts.length !== 3) return 'FY21-22';
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  if (month >= 4) {
    return 'FY' + String(year).slice(-2) + '-' + String(year + 1).slice(-2);
  }
  return 'FY' + String(year - 1).slice(-2) + '-' + String(year).slice(-2);
};
