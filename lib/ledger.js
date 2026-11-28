var dates = require('./dates');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

function financialNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return NaN;
}

function storedFinancialNumber(value = 0) {
  return financialNumber(value);
}

function customerBalance(customer, totalBilled, totalSettled) {
  return round2(storedFinancialNumber(customer.openingBalance) + totalBilled - totalSettled);
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
      openingBalance: c.openingBalance === undefined ? 0 : c.openingBalance,
      totalBilled: c.totalBilled === undefined ? 0 : c.totalBilled,
      totalSettled: c.totalSettled === undefined ? 0 : c.totalSettled,
      balance: customerBalance(c, storedFinancialNumber(c.totalBilled), storedFinancialNumber(c.totalSettled))
    };
  });
};

// Called when an order is placed with paymentMode === 'khata'
exports.chargeOrderToKhata = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer account not found for Khata billing' };

  var billed = storedFinancialNumber(c.totalBilled);
  var settled = storedFinancialNumber(c.totalSettled);
  var charge = financialNumber(orderTotal);
  var totalBilled = round2(billed + charge);
  var balance = customerBalance(c, totalBilled, settled);
  if (!Number.isFinite(totalBilled) || !Number.isFinite(balance)) {
    return { ok: false, error: 'Charge would result in an invalid Khata balance or total' };
  }

  if (c.creditLimit && balance > c.creditLimit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + c.creditLimit + ', Projected: ₹' + balance.toFixed(2) + ')'
    };
  }

  c.totalBilled = totalBilled;
  c.balance = balance;
  return { ok: true, customer: c };
};

exports.reverseOrderDebit = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: true };
  var remaining = round2(storedFinancialNumber(c.totalBilled) - financialNumber(orderTotal));
  var totalBilled = Math.max(0, remaining);
  var balance = customerBalance(c, totalBilled, storedFinancialNumber(c.totalSettled));
  if (!Number.isFinite(remaining) || !Number.isFinite(balance)) {
    return { ok: false, error: 'Reversal would result in an invalid Khata balance or total' };
  }

  c.totalBilled = totalBilled;
  c.balance = balance;
  return { ok: true };
};

// Records a customer payment settling their outstanding Khata balance
exports.recordSettlement = function (db, customerId, amount, mode, note) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  var payment = financialNumber(amount);
  if (!Number.isFinite(payment) || payment <= 0) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }

  var totalSettled = storedFinancialNumber(c.totalSettled) + payment;
  var balance = customerBalance(c, storedFinancialNumber(c.totalBilled), totalSettled);
  if (!Number.isFinite(totalSettled) || !Number.isFinite(balance)) {
    return { ok: false, error: 'Settlement would result in an invalid Khata balance or total' };
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
