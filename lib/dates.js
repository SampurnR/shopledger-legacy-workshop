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
  if (typeof str !== 'string') return '';
  var key = str.trim();
  var legacy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(key);
  if (legacy) {
    key = legacy[3] + '-' + pad2(legacy[2]) + '-' + pad2(legacy[1]);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';

  var date = new Date(key);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : '';
};

exports.getFiscalYear = function (dateStr) {
  var key = exports.normalizeDateKey(dateStr);
  if (!key) return 'FY21-22';
  var parts = key.split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  if (month >= 4) {
    return 'FY' + String(year).slice(-2) + '-' + String(year + 1).slice(-2);
  }
  return 'FY' + String(year - 1).slice(-2) + '-' + String(year).slice(-2);
};
