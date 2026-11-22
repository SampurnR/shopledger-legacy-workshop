// Date utilities for ShopLedger (Indian DD/MM/YYYY format)

function pad2(n) {
  return ('0' + n).slice(-2);
}

exports.today = function () {
  var d = new Date();
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
};

// Added for date-picker filtering (Vikram, Oct 2021)
// Accepts either DD/MM/YYYY or YYYY-MM-DD and normalizes for string comparison
exports.normalizeDateKey = function (str) {
  if (!str) return '';
  var s = String(str).trim();
  if (s.indexOf('-') !== -1) {
    // HTML5 input[type="date"] sends YYYY-MM-DD; convert to DD/MM/YYYY to match db.json
    var p = s.split('-');
    if (p.length === 3) {
      return p[2] + '/' + p[1] + '/' + p[0];
    }
  }
  return s;
};

// Calendar key for comparisons only; never change stored/display date strings.
exports.chronologicalKey = function (dateStr) {
  if (typeof dateStr !== 'string') return '';
  var s = exports.normalizeDateKey(dateStr);
  var match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!match) return '';
  var day = Number(match[1]);
  var month = Number(match[2]);
  var year = Number(match[3]);
  var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return '';
  return match[3] + match[2] + match[1];
};

exports.getFiscalYear = function (dateStr) {
  var s = exports.normalizeDateKey(dateStr);
  var parts = s.split('/');
  if (parts.length !== 3) return 'FY21-22';
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  if (month >= 4) {
    return 'FY' + String(year).slice(-2) + '-' + String(year + 1).slice(-2);
  }
  return 'FY' + String(year - 1).slice(-2) + '-' + String(year).slice(-2);
};
