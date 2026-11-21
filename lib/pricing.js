var tax = require('./tax');
var coupons = require('./coupons');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

exports.round2 = round2;

exports.subtotal = function (items) {
  var s = 0;
  for (var i = 0; i < items.length; i++) {
    s += Number(items[i].price) * Number(items[i].qty);
  }
  return round2(s);
};

exports.discount = function (subtotal, code) {
  return coupons.calculateDiscount(subtotal, code);
};

// Updated Jul 2021 (Vikram):
// 1. Apportion cart-level coupon discount across line items proportionally
// 2. Apply item-specific HSN GST slab (5%, 12%, 18%) on post-discount taxable value
exports.computeTotals = function (items, code) {
  var sub = exports.subtotal(items);
  var disc = exports.discount(sub, code);
  var discountRatio = sub > 0 ? disc / sub : 0;

  var totalTax = 0;
  var lineBreakdowns = [];
  var lineRates = [];
  var allocatedDiscount = 0;

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var lineGross = round2(Number(it.price) * Number(it.qty));
    var lineDiscount = round2(lineGross * discountRatio);
    var lineTaxable = round2(lineGross - lineDiscount);
    var rate = tax.getRateForItem(it);
    allocatedDiscount = round2(allocatedDiscount + lineDiscount);
    lineRates.push(rate);
    lineBreakdowns.push({
      id: it.id,
      name: it.name,
      hsn: it.hsn || '',
      gstPercent: Math.round(rate * 100),
      gross: lineGross,
      discount: lineDiscount,
      taxable: lineTaxable
    });
  }

  // Assign any cent-rounding remainder so line discounts add up to the cart discount.
  var discountRemainder = round2(disc - allocatedDiscount);
  for (var j = lineBreakdowns.length - 1; j >= 0 && Math.abs(discountRemainder) >= 0.01; j--) {
    var line = lineBreakdowns[j];
    var capacity = discountRemainder > 0
      ? round2(line.gross - line.discount)
      : line.discount;
    var adjustment = round2(Math.min(Math.abs(discountRemainder), capacity));
    if (adjustment <= 0) continue;

    line.discount = round2(line.discount + (discountRemainder > 0 ? adjustment : -adjustment));
    line.taxable = round2(line.gross - line.discount);
    discountRemainder = round2(discountRemainder + (discountRemainder > 0 ? -adjustment : adjustment));
  }

  for (var k = 0; k < lineBreakdowns.length; k++) {
    var breakdown = lineBreakdowns[k];
    var lineTax = round2(breakdown.taxable * lineRates[k]);
    totalTax = round2(totalTax + lineTax);
    breakdown.tax = lineTax;
    breakdown.net = round2(breakdown.taxable + lineTax);
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
