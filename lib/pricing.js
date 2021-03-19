var config = require('../config');
var coupons = require('./coupons');

var TAX_RATE = 0.18;

function round2(n) {
  return Math.round(n * 100) / 100;
}

exports.round2 = round2;

exports.subtotal = function (items) {
  var s = 0;
  for (var i = 0; i < items.length; i++) {
    s += items[i].price * items[i].qty;
  }
  return s;
};

exports.discount = function (subtotal, code) {
  return coupons.calculateDiscount(subtotal, code);
};

exports.computeTotals = function (items, code) {
  var sub = exports.subtotal(items);
  var disc = exports.discount(sub, code);
  var taxable = sub - disc;
  var tax = round2(taxable * TAX_RATE);
  return {
    subtotal: round2(sub),
    discount: round2(disc),
    tax: tax,
    total: round2(taxable + tax)
  };
};
