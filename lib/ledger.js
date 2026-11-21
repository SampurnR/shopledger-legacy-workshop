var dates = require('./dates');

function round2(n) {
  var rounded = Math.round((Number(n) + 1e-9) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
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
      balance: round2((c.openingBalance || 0) + (c.totalBilled || 0) - (c.totalSettled || 0))
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

  var payment = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : NaN;
  if (!Number.isFinite(payment) || payment <= 0) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }
  if (payment !== round2(payment)) {
    return { ok: false, error: 'Settlement amount must be in whole paise' };
  }

  var totalDue = (c.openingBalance || 0) + (c.totalBilled || 0);
  var totalSettled = c.totalSettled == null ? 0 : Number(c.totalSettled);
  var outstanding = round2(totalDue - totalSettled);
  if (!Number.isFinite(outstanding)) {
    return { ok: false, error: 'Customer Khata balance is invalid' };
  }
  if (payment > outstanding) {
    return { ok: false, error: 'Settlement amount cannot exceed the outstanding balance' };
  }

  // Preserve any fractional paise already recorded by the old API.
  var updatedTotal = totalSettled + payment;
  c.totalSettled = totalSettled === round2(totalSettled) ? round2(updatedTotal) : updatedTotal;
  c.balance = round2(totalDue - c.totalSettled);

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
