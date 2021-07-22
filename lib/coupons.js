var config = require('../config');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

exports.normalizeCode = function (code) {
  if (!code) return '';
  return String(code).trim().toUpperCase();
};

exports.getCoupon = function (code) {
  var clean = exports.normalizeCode(code);
  if (!clean) return null;
  var c = config.coupons[clean];
  if (!c || c.active === false) return null;
  return {
    code: clean,
    type: c.type,
    value: c.value,
    minOrder: c.minOrder || 0,
    maxDiscount: c.maxDiscount || null,
    description: c.description || ''
  };
};

exports.validate = function (code, subtotal) {
  var clean = exports.normalizeCode(code);
  if (!clean) return { valid: true, code: '', discount: 0 };

  var c = config.coupons[clean];
  if (!c) {
    return { valid: false, error: 'Invalid coupon code: ' + clean };
  }
  if (c.active === false) {
    return { valid: false, error: 'Coupon ' + clean + ' has expired' };
  }
  if (c.minOrder && subtotal < c.minOrder) {
    return {
      valid: false,
      error: 'Coupon ' + clean + ' requires a minimum order subtotal of ₹' + c.minOrder
    };
  }

  var disc = exports.calculateDiscount(subtotal, clean);
  return {
    valid: true,
    code: clean,
    discount: disc,
    coupon: c
  };
};

exports.calculateDiscount = function (subtotal, code) {
  var c = exports.getCoupon(code);
  if (!c || subtotal <= 0) return 0;
  if (c.minOrder && subtotal < c.minOrder) return 0;

  var disc = 0;
  if (c.type === 'percent') {
    disc = (subtotal * c.value) / 100;
    if (c.maxDiscount && disc > c.maxDiscount) {
      disc = c.maxDiscount;
    }
  } else if (c.type === 'flat') {
    disc = Math.min(c.value, subtotal);
  }

  return round2(Math.min(disc, subtotal));
};

exports.listActive = function () {
  var result = [];
  var keys = Object.keys(config.coupons || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var c = config.coupons[k];
    if (c && c.active !== false) {
      result.push({
        code: k,
        type: c.type,
        value: c.value,
        minOrder: c.minOrder || 0,
        maxDiscount: c.maxDiscount || null,
        description: c.description || ''
      });
    }
  }
  return result;
};
