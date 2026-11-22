var express = require('express');
var store = require('../lib/store');
var ledger = require('../lib/ledger');
var replay = require('../lib/request-replay');

var router = express.Router();

router.get('/customers', function (req, res) {
  var db = store.read();
  res.json({
    customers: ledger.listCustomers(db),
    settlements: (db.settlements || []).slice(0, 25)
  });
});

router.post('/customers/:id/settle', function (req, res) {
  var db = store.read();
  var remember = replay.start(db, req, res, 'settlement:' + Number(req.params.id));
  if (!remember) return;
  var body = req.body || {};
  var mode = String(body.mode || 'upi').toLowerCase();
  if (['cash', 'upi', 'neft'].indexOf(mode) === -1) {
    return res.status(400).json({ error: 'Unsupported settlement mode' });
  }

  // Pass amount directly from request payload
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
    result.customer.name + ' settled ₹' + result.settlement.amount.toFixed(2) + ' via ' + mode.toUpperCase()
  );
  remember(result);
  store.write(db);

  res.status(201).json(result);
});

module.exports = router;
