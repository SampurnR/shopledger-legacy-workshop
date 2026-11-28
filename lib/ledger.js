var dates = require('./dates');
var maxPaisaDigits = String(Number.MAX_SAFE_INTEGER).length;

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

function toPaisa(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return NaN;
  var parts = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(value).trim());
  if (!parts || !(parts[2] || parts[3])) return NaN;

  var fraction = parts[3] || '';
  var digits = (parts[2] + fraction).replace(/^0+/, '');
  if (!digits) return 0;

  // Shift the decimal to paisa before converting digits to a Number.
  var places = Number(parts[4] || 0) + 2 - fraction.length;
  if (places < 0) {
    var end = digits.length + places;
    if (end <= 0 || /[1-9]/.test(digits.slice(end))) return NaN;
    digits = digits.slice(0, end);
    places = 0;
  }
  if (digits.length + places > maxPaisaDigits) return NaN;

  var paisa = Number(parts[1] + digits + '0'.repeat(places));
  return Number.isSafeInteger(paisa) ? paisa : NaN;
}

function fromPaisa(paisa) {
  var amount = paisa / 100;
  return Number.isSafeInteger(paisa) && toPaisa(amount) === paisa ? amount : NaN;
}

function storedPaisa(value) {
  return value === undefined ? 0 : toPaisa(value);
}

function customerBalance(customer, settledPaisa) {
  var opening = storedPaisa(customer.openingBalance);
  var billed = storedPaisa(customer.totalBilled);
  if (!Number.isSafeInteger(opening) || !Number.isSafeInteger(billed) || !Number.isSafeInteger(settledPaisa)) {
    return NaN;
  }
  var balance = BigInt(opening) + BigInt(billed) - BigInt(settledPaisa);
  return fromPaisa(Number(balance));
}

function findCustomer(db, id) {
  if (!id || !db.customers) return null;
  for (var i = 0; i < db.customers.length; i++) {
    if (db.customers[i].id == id) return db.customers[i];
  }
  return null;
}

exports.findCustomer = findCustomer;

exports.listCustomers = function (db) {
  return (db.customers || []).map(function (c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type || 'Retail',
      gstin: c.gstin || '',
      creditLimit: c.creditLimit || 5000,
      openingBalance: c.openingBalance || 0,
      totalBilled: c.totalBilled || 0,
      totalSettled: c.totalSettled || 0,
      balance: customerBalance(c, storedPaisa(c.totalSettled))
    };
  });
};

// Called when an order is placed with paymentMode === 'khata'
exports.chargeOrderToKhata = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer account not found for Khata billing' };

  var currentBalance = round2((c.openingBalance || 0) + (c.totalBilled || 0) - (c.totalSettled || 0));
  var projected = round2(currentBalance + Number(orderTotal));

  if (c.creditLimit && projected > c.creditLimit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + c.creditLimit + ', Projected: ₹' + projected.toFixed(2) + ')'
    };
  }

  c.totalBilled = round2((c.totalBilled || 0) + Number(orderTotal));
  c.balance = round2((c.openingBalance || 0) + c.totalBilled - (c.totalSettled || 0));
  return { ok: true, customer: c };
};

exports.reverseOrderDebit = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return;
  c.totalBilled = Math.max(0, round2((c.totalBilled || 0) - Number(orderTotal)));
  c.balance = round2((c.openingBalance || 0) + c.totalBilled - (c.totalSettled || 0));
};

// Records a customer payment settling their outstanding Khata balance
exports.recordSettlement = function (db, customerId, amount, mode, note) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  var payment = typeof amount === 'string' || typeof amount === 'number' ? Number(amount) : NaN;
  if (!Number.isFinite(payment) || payment <= 0) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }
  var paymentPaisa = toPaisa(amount);
  payment = fromPaisa(paymentPaisa);
  if (!Number.isFinite(payment)) {
    return { ok: false, error: 'Settlement amount must be representable in whole paisa' };
  }

  var settledPaisa = storedPaisa(c.totalSettled) + paymentPaisa;
  var totalSettled = fromPaisa(settledPaisa);
  var balance = customerBalance(c, settledPaisa);
  if (!Number.isFinite(totalSettled) || !Number.isFinite(balance)) {
    return { ok: false, error: 'Customer ledger balance is invalid' };
  }

  c.totalSettled = totalSettled;
  c.balance = balance;

  var entry = {
    id: db.nextSettlementId++,
    customerId: c.id,
    customerName: c.name,
    date: dates.today(),
    amount: payment,
    mode: mode || 'upi',
    note: note || 'Khata settlement'
  };

  if (!db.settlements) db.settlements = [];
  db.settlements.unshift(entry);

  return {
    ok: true,
    settlement: entry,
    customer: c
  };
};
