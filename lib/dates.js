// Date utilities for ShopLedger (Indian DD/MM/YYYY format)

function pad2(n) {
  return ('0' + n).slice(-2);
}

exports.today = function () {
  var d = new Date();
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
};

// Added for date-picker filtering (Vikram, Oct 2021)
// Accepts either DD/MM/YYYY or YYYY-MM-DD and normalizes to YYYY-MM-DD for comparison and sorting
exports.normalizeDateKey = function (str) {
  if (!str) return '';
  var s = String(str).trim();
  if (s.indexOf('/') !== -1) {
    var p = s.split('/');
    if (p.length === 3) {
      var day = ('0' + p[0]).slice(-2);
      var month = ('0' + p[1]).slice(-2);
      var year = p[2].length === 2 ? '20' + p[2] : p[2];
      return year + '-' + month + '-' + day;
    }
  } else if (s.indexOf('-') !== -1) {
    var p = s.split('-');
    if (p.length === 3) {
      var year = p[0].length === 2 ? '20' + p[0] : p[0];
      var month = ('0' + p[1]).slice(-2);
      var day = ('0' + p[2]).slice(-2);
      return year + '-' + month + '-' + day;
    }
  }
  return s;
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
