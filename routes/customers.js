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

var ALLOWED_SETTLEMENT_MODES = { upi: true, cash: true, neft: true };

router.post('/customers/:id/settle', function (req, res) {
  var db = store.read();
  var body = req.body || {};
  var mode = String(body.mode || 'upi').trim().toLowerCase();

  if (!ALLOWED_SETTLEMENT_MODES[mode]) {
    return res.status(400).json({ error: 'Unsupported settlement mode: ' + mode });
  }

  var result = ledger.recordSettlement(
    db,
    req.params.id,
    body.amount,
    mode,
    body.note || ''
  );

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  store.appendAudit(
    db,
    'KHATA_SETTLEMENT',
    result.customer.name + ' settled ₹' + result.settlement.amount.toFixed(2) + ' via ' + result.settlement.mode.toUpperCase()
  );
  store.write(db);

  res.status(201).json(result);
});

module.exports = router;
