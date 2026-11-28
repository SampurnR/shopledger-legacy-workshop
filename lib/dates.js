// Date utilities for ShopLedger (Indian DD/MM/YYYY format)

function pad2(n) {
  return ('0' + n).slice(-2);
}

exports.today = function () {
  var d = new Date();
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
};

function parseDateParts(str) {
  if (!str) return null;
  var s = String(str).trim();
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  var year;
  var month;
  var day;

  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  var leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;

  return { year: year, month: month, day: day };
}

// Both persisted display dates and HTML date inputs become an ISO-ordered key,
// allowing ordinary string comparison without locale or timezone conversion.
exports.normalizeDateKey = function (str) {
  var parts = parseDateParts(str);
  if (!parts) return '';
  return parts.year + '-' + pad2(parts.month) + '-' + pad2(parts.day);
};

exports.getFiscalYear = function (dateStr) {
  var parts = parseDateParts(dateStr);
  if (!parts) return 'FY21-22';
  var month = parts.month;
  var year = parts.year;
  if (month >= 4) {
    return 'FY' + String(year).slice(-2) + '-' + String(year + 1).slice(-2);
  }
  return 'FY' + String(year - 1).slice(-2) + '-' + String(year).slice(-2);
};
