var dates = require('./dates');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

function findCustomer(db, id) {
  if (!id || !db.customers) return null;
  for (var i = 0; i < db.customers.length; i++) {
    if (db.customers[i].id == id) return db.customers[i];
  }
  return null;
}

exports.findCustomer = findCustomer;

function getBalance(c) {
  return round2(Number(c.openingBalance || 0) + Number(c.totalBilled || 0) - Number(c.totalSettled || 0));
}

function getCreditLimit(c) {
  return c.creditLimit == null ? 5000 : Number(c.creditLimit);
}

exports.listCustomers = function (db) {
  return (db.customers || []).map(function (c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type || 'Retail',
      gstin: c.gstin || '',
      creditLimit: getCreditLimit(c),
      openingBalance: c.openingBalance || 0,
      totalBilled: c.totalBilled || 0,
      totalSettled: Number(c.totalSettled || 0),
      balance: getBalance(c)
    };
  });
};

// Called when an order is placed with paymentMode === 'khata'
exports.chargeOrderToKhata = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer account not found for Khata billing' };

  var projected = round2(getBalance(c) + Number(orderTotal));
  var limit = getCreditLimit(c);

  if (!Number.isFinite(projected) || !Number.isFinite(limit)) {
    return { ok: false, error: 'Customer Khata balance or credit limit is invalid' };
  }
  if (projected > limit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + limit + ', Projected: ₹' + projected.toFixed(2) + ')'
    };
  }

  c.totalBilled = round2(Number(c.totalBilled || 0) + Number(orderTotal));
  c.balance = getBalance(c);
  return { ok: true, customer: c };
};

exports.reverseOrderDebit = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return;
  c.totalBilled = Math.max(0, round2((c.totalBilled || 0) - Number(orderTotal)));
  c.balance = getBalance(c);
};

// Records a customer payment settling their outstanding Khata balance
exports.recordSettlement = function (db, customerId, amount, mode, note) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  if (typeof amount !== 'number' && typeof amount !== 'string') {
    return { ok: false, error: 'Enter a valid settlement amount greater than zero' };
  }
  var value = round2(amount);
  var totalSettled = round2(Number(c.totalSettled || 0) + value);
  if (value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) {
    return { ok: false, error: 'Enter a valid settlement amount greater than zero' };
  }
  if (!Number.isSafeInteger(Math.round(totalSettled * 100)) || !Number.isFinite(getBalance(c))) {
    return { ok: false, error: 'Customer Khata balance is invalid' };
  }
  if ((mode != null && typeof mode !== 'string') || (note != null && typeof note !== 'string')) {
    return { ok: false, error: 'Settlement mode and note must be text' };
  }

  // Update customer ledger totals
  c.totalSettled = totalSettled;
  c.balance = getBalance(c);

  var entry = {
    id: db.nextSettlementId++,
    customerId: c.id,
    customerName: c.name,
    date: dates.today(),
    amount: value,
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
