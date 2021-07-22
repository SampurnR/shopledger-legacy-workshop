var config = require('../config');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

exports.round2 = round2;

// Resolves the GST rate (as a decimal, e.g. 0.05, 0.12, 0.18) for a product or order line item
exports.getRateForItem = function (item) {
  if (!item) return config.tax.defaultRate;

  if (typeof item.gstRate === 'number' && !isNaN(item.gstRate)) {
    return item.gstRate > 1 ? item.gstRate / 100 : item.gstRate;
  }

  if (item.hsn && config.tax.hsnSlabs && config.tax.hsnSlabs[item.hsn] != null) {
    return config.tax.hsnSlabs[item.hsn] / 100;
  }

  return config.tax.defaultRate;
};

exports.getSlabPercent = function (item) {
  return Math.round(exports.getRateForItem(item) * 100);
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
