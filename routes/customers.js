var express = require('express');
var store = require('../lib/store');
var ledger = require('../lib/ledger');

var router = express.Router();

router.get('/customers', function (req, res) {
  var db = store.read();
  res.json({
    customers: ledger.listCustomers(db),
    settlements: (db.settlements || []).slice(0, 25)
  });
});

router.post('/customers/:id/settle', store.mutation(function (req, res, db, save) {
  var body = req.body || {};

  // Pass amount directly from request payload
  var result = ledger.recordSettlement(
    db,
    req.params.id,
    body.amount,
    body.mode || 'upi',
    body.note || ''
  );

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  store.appendAudit(
    db,
    'KHATA_SETTLEMENT',
    result.customer.name + ' settled ₹' + result.settlement.amount.toFixed(2) + ' via ' + (body.mode || 'upi').toUpperCase()
  );
  return save(result);
}, true));

module.exports = router;
