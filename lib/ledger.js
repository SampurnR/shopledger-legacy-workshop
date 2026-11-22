var dates = require('./dates');

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
    var totals = customerTotals(c);
    if (!totals.ok) throw new Error(totals.error);
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
      balance: totals.balance / 100
    };
  });
};

// Called when an order is placed with paymentMode === 'khata'
exports.chargeOrderToKhata = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer account not found for Khata billing' };

  var totals = customerTotals(c);
  if (!totals.ok) return totals;
  var debit = toPaise(orderTotal);
  if (debit === null || Number(orderTotal) < 0) {
    return { ok: false, error: 'Invalid Khata order amount' };
  }
  var billed = totals.billed + debit;
  var gross = totals.opening + billed;
  var projected = gross - totals.settled;
  if (!Number.isSafeInteger(billed) || !Number.isSafeInteger(gross) || !Number.isSafeInteger(projected)) {
    return { ok: false, error: 'Khata charge exceeds safe currency range' };
  }

  var limit = c.creditLimit ? toPaise(c.creditLimit) : null;
  if (c.creditLimit && (limit === null || Number(c.creditLimit) < 0)) {
    return { ok: false, error: 'Invalid Khata credit limit' };
  }
  if (c.creditLimit && projected > limit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + c.creditLimit + ', Projected: ₹' + (projected / 100).toFixed(2) + ')'
    };
  }

  c.totalBilled = billed / 100;
  c.balance = projected / 100;
  return { ok: true, customer: c };
};

exports.reverseOrderDebit = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return;
  var totals = customerTotals(c);
  var debit = toPaise(orderTotal);
  // Preserve this helper's void contract on missing/invalid records.
  if (!totals.ok || debit === null || Number(orderTotal) < 0) return;
  var billed = Math.max(0, totals.billed - debit);
  var gross = totals.opening + billed;
  var balance = gross - totals.settled;
  if (!Number.isSafeInteger(billed) || !Number.isSafeInteger(gross) || !Number.isSafeInteger(balance)) return;
  c.totalBilled = billed / 100;
  c.balance = balance / 100;
};

// Validate original types before conversion; work in safe integer paise.
function toPaise(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && value.trim() === '')) return null;
  var number = Number(value);
  if (!Number.isFinite(number)) return null;
  var paise = Math.round((number + 1e-9) * 100);
  return Number.isSafeInteger(paise) ? paise : null;
}

// Read-only shared calculation for settlement and customer reporting.
function customerTotals(c) {
  var settled = toPaise(c.totalSettled === undefined ? 0 : c.totalSettled);
  var opening = toPaise(c.openingBalance === undefined ? 0 : c.openingBalance);
  var billed = toPaise(c.totalBilled === undefined ? 0 : c.totalBilled);
  if (settled === null || settled < 0 || opening === null || billed === null || billed < 0) {
    return { ok: false, error: 'Invalid customer ledger totals' };
  }
  var gross = opening + billed;
  var balance = gross - settled;
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(balance)) {
    return { ok: false, error: 'Customer ledger totals exceed safe currency range' };
  }
  return { ok: true, opening: opening, billed: billed, settled: settled, gross: gross, balance: balance };
}

// Records a customer payment settling their outstanding Khata balance
exports.recordSettlement = function (db, customerId, amount, mode, note) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  var payment = toPaise(amount);
  if (payment === null || payment <= 0) {
    return { ok: false, error: 'Settlement amount must be greater than zero' };
  }

  var totals = customerTotals(c);
  if (!totals.ok) return totals;
  var newSettled = totals.settled + payment;
  var gross = totals.gross;
  var balance = gross - newSettled;
  if (!Number.isSafeInteger(newSettled) || !Number.isSafeInteger(gross) || !Number.isSafeInteger(balance)) {
    return { ok: false, error: 'Settlement exceeds safe currency range' };
  }

  var entry = {
    id: db.nextSettlementId,
    customerId: c.id,
    customerName: c.name,
    date: dates.today(),
    amount: payment / 100,
    mode: mode || 'upi',
    note: note || 'Khata settlement'
  };

  // Commit only after all monetary values have been validated.
  c.totalSettled = newSettled / 100;
  c.balance = balance / 100;
  db.nextSettlementId++;
  if (!db.settlements) db.settlements = [];
  db.settlements.unshift(entry);

  return {
    ok: true,
    settlement: entry,
    customer: c
  };
};
