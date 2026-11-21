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
  var s = String(str || '').trim();
  var local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (local) return local[3] + '-' + pad2(local[2]) + '-' + pad2(local[1]);

  var iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  return iso ? iso[1] + '-' + pad2(iso[2]) + '-' + pad2(iso[3]) : '';
};

exports.getFiscalYear = function (dateStr) {
  var s = exports.normalizeDateKey(dateStr);
  var parts = s.split('-');
  if (parts.length !== 3) return 'FY21-22';
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[0], 10);
  if (month >= 4) {
    return 'FY' + String(year).slice(-2) + '-' + String(year + 1).slice(-2);
  }
  return 'FY' + String(year - 1).slice(-2) + '-' + String(year).slice(-2);
};
