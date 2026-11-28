var dates = require('./dates');

function round2(n) {
  var val = Number(n);
  if (!isFinite(val)) return val;
  var sign = val < 0 ? -1 : 1;
  var rounded = Math.round((val + sign * 1e-9) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function findCustomer(db, id) {
  if (!db || !db.customers || id == null || (typeof id !== 'number' && typeof id !== 'string')) return null;
  if (typeof id === 'string' && id.trim() === '') return null;
  if (typeof id === 'number' && isNaN(id)) return null;
  for (var i = 0; i < db.customers.length; i++) {
    if (db.customers[i].id == id) return db.customers[i];
  }
  return null;
}

exports.findCustomer = findCustomer;

exports.listCustomers = function (db) {
  return ((db && db.customers) || []).map(function (c) {
    var opening = Number(c.openingBalance || 0);
    var billed = Number(c.totalBilled || 0);
    var settled = Number(c.totalSettled || 0);
    var limit = c.creditLimit != null ? Number(c.creditLimit) : 5000;
    if (!isFinite(limit)) limit = 5000;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type || 'Retail',
      gstin: c.gstin || '',
      creditLimit: limit,
      openingBalance: round2(opening),
      totalBilled: round2(billed),
      totalSettled: round2(settled),
      balance: round2(opening + billed - settled)
    };
  });
};

// Called when an order is placed with paymentMode === 'khata'
exports.chargeOrderToKhata = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer account not found for Khata billing' };

  var total = Number(orderTotal);
  if (
    orderTotal == null ||
    typeof orderTotal === 'boolean' ||
    (typeof orderTotal !== 'number' && typeof orderTotal !== 'string') ||
    (typeof orderTotal === 'string' && orderTotal.trim() === '') ||
    !isFinite(total) ||
    total < 0
  ) {
    return { ok: false, error: 'Invalid order total for Khata billing' };
  }

  var opening = Number(c.openingBalance || 0);
  var billed = Number(c.totalBilled || 0);
  var settled = Number(c.totalSettled || 0);
  var currentBalance = round2(opening + billed - settled);
  var projected = round2(currentBalance + total);
  var limit = c.creditLimit != null ? Number(c.creditLimit) : 5000;
  if (!isFinite(limit)) limit = 5000;

  if (projected > limit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + limit + ', Projected: ₹' + projected.toFixed(2) + ')'
    };
  }

  c.totalBilled = round2(billed + total);
  c.balance = round2(opening + c.totalBilled - settled);
  return { ok: true, customer: c };
};

exports.reverseOrderDebit = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return;
  if (orderTotal == null || typeof orderTotal === 'boolean' || (typeof orderTotal !== 'number' && typeof orderTotal !== 'string')) return;
  var total = Number(orderTotal);
  if (!isFinite(total) || total <= 0) return;
  var opening = Number(c.openingBalance || 0);
  var billed = Number(c.totalBilled || 0);
  var settled = Number(c.totalSettled || 0);
  c.totalBilled = Math.max(0, round2(billed - total));
  c.balance = round2(opening + c.totalBilled - settled);
};

// Records a customer payment settling their outstanding Khata balance
exports.recordSettlement = function (db, customerId, amount, mode, note) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  if (
    amount == null ||
    typeof amount === 'boolean' ||
    (typeof amount !== 'number' && typeof amount !== 'string') ||
    (typeof amount === 'string' && amount.trim() === '')
  ) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }

  var rawAmount = Number(amount);
  var numAmount = round2(rawAmount);
  if (!isFinite(rawAmount) || rawAmount <= 0 || numAmount <= 0) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }

  // Update customer ledger totals
  var opening = Number(c.openingBalance || 0);
  var billed = Number(c.totalBilled || 0);
  c.totalSettled = round2(Number(c.totalSettled || 0) + numAmount);
  c.balance = round2(opening + billed - c.totalSettled);

  if (!db.nextSettlementId) db.nextSettlementId = 501;
  var entry = {
    id: db.nextSettlementId++,
    customerId: c.id,
    customerName: c.name,
    date: dates.today(),
    amount: numAmount,
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
