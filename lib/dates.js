// Date utilities for ShopLedger (Indian DD/MM/YYYY format)

function pad2(n) {
  return ('0' + n).slice(-2);
}

exports.today = function () {
  var d = new Date();
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
};

// Added for date-picker filtering (Vikram, Oct 2021)
// Accepts either DD/MM/YYYY or YYYY-MM-DD and normalizes to YYYY-MM-DD for chronological string comparison
exports.normalizeDateKey = function (str) {
  if (!str) return '';
  var s = String(str).trim();
  if (s.indexOf('-') !== -1) {
    var iso = s.split('-');
    if (iso.length === 3) {
      return iso[0] + '-' + pad2(iso[1]) + '-' + pad2(iso[2]);
    }
  }
  if (s.indexOf('/') !== -1) {
    var dmy = s.split('/');
    if (dmy.length === 3) {
      return dmy[2] + '-' + pad2(dmy[1]) + '-' + pad2(dmy[0]);
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
  if (isNaN(year) || isNaN(month)) return 'FY21-22';
  if (month >= 4) {
    return 'FY' + String(year).slice(-2) + '-' + String(year + 1).slice(-2);
  }
  return 'FY' + String(year - 1).slice(-2) + '-' + String(year).slice(-2);
};
