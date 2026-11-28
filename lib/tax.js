var config = require('../config');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

exports.round2 = round2;

// Resolves the GST rate (as a decimal, e.g. 0.05, 0.12, 0.18) for a product or order line item
exports.getRateForItem = function (item, legacy) {
  if (!item) return config.tax.defaultRate;

  if (Number.isFinite(item.gstRate) && item.gstRate >= 0 && item.gstRate <= 100) {
    return item.gstRate > 1 ? item.gstRate / 100 : item.gstRate;
  }

  var hsn = String(item.hsn || '');
  var slabs = config.tax.hsnSlabs || {};
  if (legacy) {
    return Object.prototype.hasOwnProperty.call(slabs, hsn) ? slabs[hsn] / 100 : config.tax.defaultRate;
  }

  hsn = hsn.trim();
  if (/^\d{4,8}$/.test(hsn)) {
    if (slabs[hsn] != null) return slabs[hsn] / 100;
    if (slabs[hsn.slice(0, 4)] != null) return slabs[hsn.slice(0, 4)] / 100;
  }

  return config.tax.defaultRate;
};

exports.rateToPercent = function (rate) {
  return Number((rate * 100).toPrecision(15));
};

exports.getSlabPercent = function (item) {
  return exports.rateToPercent(exports.getRateForItem(item));
};

// Intra-state Maharashtra supply splits GST equally into CGST + SGST
exports.splitCgstSgst = function (taxAmount) {
  var half = round2(taxAmount / 2);
  var remainder = round2(taxAmount - half);
  return {
    cgst: half,
    sgst: remainder
  };
};
