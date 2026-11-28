var tax = require('./tax');
var coupons = require('./coupons');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

exports.round2 = round2;

exports.subtotal = function (items, legacy) {
  var s = 0;
  for (var i = 0; i < items.length; i++) {
    var gross = Number(items[i].price) * Number(items[i].qty);
    s += legacy ? gross : round2(gross);
  }
  return round2(s);
};

exports.discount = function (subtotal, code) {
  return coupons.calculateDiscount(subtotal, code);
};

// Updated Jul 2021 (Vikram):
// 1. Apportion cart-level coupon discount across line items proportionally
// 2. Apply item-specific HSN GST slab (5%, 12%, 18%) on post-discount taxable value
exports.computeTotals = function (items, code, options) {
  options = options || {};
  var legacy = options.legacy === true;
  var sub = exports.subtotal(items, legacy);
  var disc = Number.isFinite(options.recordedDiscount)
    ? round2(Math.max(0, Math.min(sub, options.recordedDiscount)))
    : exports.discount(sub, code);
  var discountRatio = sub > 0 ? disc / sub : 0;

  var pricedLines = items.map(function (item, index) {
    return {
      index: index,
      productKey: String(item.id == null ? item.sku || item.name || '' : item.id),
      gross: round2(Number(item.price) * Number(item.qty)),
      rate: tax.getRateForItem(item, legacy)
    };
  });
  if (!legacy && disc) {
    // Use the same allocation order even when the cart lines are rearranged.
    pricedLines.sort(function (a, b) {
      return a.rate - b.rate || a.gross - b.gross || a.productKey.localeCompare(b.productKey);
    });
  }

  var grossSoFar = 0;
  var discountSoFar = 0;
  var totalTax = 0;
  var lineBreakdowns = [];

  for (var i = 0; i < pricedLines.length; i++) {
    var line = pricedLines[i];
    var it = items[line.index];
    var lineGross = line.gross;
    var lineDiscount = 0;
    if (legacy) {
      lineDiscount = round2(lineGross * discountRatio);
    } else if (disc) {
      // Allocate differences between rounded running totals so every cent is assigned.
      grossSoFar = round2(grossSoFar + lineGross);
      var allocated = round2(grossSoFar * discountRatio);
      lineDiscount = round2(allocated - discountSoFar);
      discountSoFar = allocated;
    }
    var lineTaxable = round2(lineGross - lineDiscount);
    var rate = line.rate;
    var lineTax = round2(lineTaxable * rate);

    totalTax = round2(totalTax + lineTax);
    lineBreakdowns[line.index] = {
      id: it.id,
      name: it.name,
      hsn: it.hsn || '',
      gstPercent: tax.rateToPercent(rate),
      gross: lineGross,
      discount: lineDiscount,
      taxable: lineTaxable,
      tax: lineTax,
      net: round2(lineTaxable + lineTax)
    };
  }

  var taxable = round2(sub - disc);
  var split = tax.splitCgstSgst(totalTax);

  return {
    subtotal: round2(sub),
    discount: round2(disc),
    taxable: taxable,
    tax: round2(totalTax),
    cgst: split.cgst,
    sgst: split.sgst,
    total: round2(taxable + totalTax),
    lines: lineBreakdowns
  };
};
