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

function creditLimit(customer) {
  return customer.creditLimit == null ? 5000 : Number(customer.creditLimit);
}

exports.listCustomers = function (db) {
  return (db.customers || []).map(function (c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type || 'Retail',
      gstin: c.gstin || '',
      creditLimit: creditLimit(c),
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

  var limit = creditLimit(c);
  if (!Number.isFinite(limit) || projected > limit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + limit + ', Projected: ₹' + projected.toFixed(2) + ')'
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
  if (!Number.isSafeInteger(Math.round(payment * 100)) || payment <= 0 || round2(payment) !== payment) {
    return { ok: false, error: 'Settlement amount must be positive and have at most two decimal places' };
  }

  var settled = round2(Number(c.totalSettled || 0) + payment);
  if (!Number.isSafeInteger(Math.round(settled * 100))) {
    return { ok: false, error: 'Settlement would put the account total outside the supported range' };
  }
  c.totalSettled = settled;
  c.balance = round2((c.openingBalance || 0) + (c.totalBilled || 0) - c.totalSettled);

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
