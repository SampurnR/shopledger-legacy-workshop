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

exports.listCustomers = function (db) {
  return (db.customers || []).map(function (c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type || 'Retail',
      gstin: c.gstin || '',
      creditLimit: c.creditLimit == null ? 5000 : Number(c.creditLimit),
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

  var creditLimit = c.creditLimit == null ? 5000 : Number(c.creditLimit);
  if (projected > creditLimit) {
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
exports.recordSettlement = function (db, customerId, amount, mode, note, requestId) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  var numericAmount = Number(amount);
  if (!isFinite(numericAmount) || numericAmount <= 0) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }
  numericAmount = round2(numericAmount);
  if (numericAmount < 0.01) {
    return { ok: false, error: 'Settlement amount must be at least ₹0.01' };
  }
  if (requestId) {
    for (var i = 0; i < (db.settlements || []).length; i++) {
      var existing = db.settlements[i];
      if (existing.requestId === requestId) {
        if (existing.customerId !== c.id || existing.amount !== numericAmount ||
            existing.mode !== (mode || 'upi') || existing.note !== (note || 'Khata settlement')) {
          return { ok: false, error: 'Request ID was already used for a different settlement' };
        }
        return { ok: true, duplicate: true, settlement: existing, customer: c };
      }
    }
  }

  // Update customer ledger totals
  c.totalSettled = round2(Number(c.totalSettled || 0) + numericAmount);
  c.balance = round2((c.openingBalance || 0) + (c.totalBilled || 0) - c.totalSettled);

  var entry = {
    id: db.nextSettlementId++,
    customerId: c.id,
    customerName: c.name,
    date: dates.today(),
    amount: numericAmount,
    mode: mode || 'upi',
    note: note || 'Khata settlement',
    requestId: requestId || null
  };

  if (!db.settlements) db.settlements = [];
  db.settlements.unshift(entry);

  return {
    ok: true,
    settlement: entry,
    customer: c
  };
};
