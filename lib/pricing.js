var tax = require('./tax');
var coupons = require('./coupons');
var inventory = require('./inventory');

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

// Resolve the same catalog price, quantity and GST rate for preview and checkout.
exports.resolveItems = function (products, requested) {
  if (!Array.isArray(requested) || !requested.length) {
    return { error: 'Pick at least one item to place an order' };
  }
  var items = [];
  for (var i = 0; i < requested.length; i++) {
    var item = requested[i];
    var qty = item && (typeof item.qty === 'number' || typeof item.qty === 'string')
      ? Number(item.qty) : NaN;
    if (!Number.isSafeInteger(qty) || qty < 1) {
      return { error: 'Item quantities must be positive whole numbers' };
    }
    var p = inventory.find(products, item.id);
    if (!p) return { error: 'Unknown product ID ' + item.id };
    items.push({
      id: p.id, sku: p.sku, name: p.name, hsn: p.hsn,
      price: p.price, qty: qty, gstRate: tax.getRateForItem(p)
    });
  }
  return { items: items };
};

// Updated Jul 2021 (Vikram):
// 1. Apportion cart-level coupon discount across line items proportionally
// 2. Apply item-specific HSN GST slab (5%, 12%, 18%) on post-discount taxable value
exports.computeTotals = function (items, code) {
  var sub = exports.subtotal(items);
  var disc = exports.discount(sub, code);
  var grossSoFar = 0;
  var discountSoFar = 0;

  var totalTax = 0;
  var lineBreakdowns = [];

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var lineGross = round2(Number(it.price) * Number(it.qty));
    grossSoFar += Number(it.price) * Number(it.qty);
    var allocated = i === items.length - 1 ? disc : round2(sub > 0 ? disc * grossSoFar / sub : 0);
    var lineDiscount = round2(allocated - discountSoFar);
    discountSoFar = allocated;
    var lineTaxable = round2(lineGross - lineDiscount);
    var rate = tax.getRateForItem(it);
    var lineTax = round2(lineTaxable * rate);

    totalTax = round2(totalTax + lineTax);
    lineBreakdowns.push({
      id: it.id,
      name: it.name,
      hsn: it.hsn || '',
      gstPercent: Math.round(rate * 100),
      gross: lineGross,
      discount: lineDiscount,
      taxable: lineTaxable,
      tax: lineTax,
      net: round2(lineTaxable + lineTax)
    });
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
