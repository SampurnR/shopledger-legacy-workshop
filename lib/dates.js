// Date utilities for ShopLedger (Indian DD/MM/YYYY format)

function pad2(n) {
  return ('0' + n).slice(-2);
}

exports.today = function () {
  var d = new Date();
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
};

// Added for date-picker filtering (Vikram, Oct 2021)
// Accepts stored DD/MM/YYYY dates and HTML date-input YYYY-MM-DD values.
// ISO ordering makes lexicographic comparisons chronological.
exports.normalizeDateKey = function (str) {
  if (!str) return '';
  var s = String(str).trim();
  var p;
  var year;
  var month;
  var day;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    p = s.split('-');
    year = Number(p[0]);
    month = Number(p[1]);
    day = Number(p[2]);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    p = s.split('/');
    day = Number(p[0]);
    month = Number(p[1]);
    year = Number(p[2]);
  } else {
    return '';
  }

  var parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return '';
  }

  return ('0000' + year).slice(-4) + '-' + pad2(month) + '-' + pad2(day);
};

exports.getFiscalYear = function (dateStr) {
  var s = exports.normalizeDateKey(dateStr);
  if (!s) return 'FY21-22';
  var parts = s.split('-');
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[0], 10);
  if (month >= 4) {
    return 'FY' + String(year).slice(-2) + '-' + String(year + 1).slice(-2);
  }
  return 'FY' + String(year - 1).slice(-2) + '-' + String(year).slice(-2);
};
