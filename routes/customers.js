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

router.post('/customers/:id/settle', function (req, res) {
  store.withLock(function () {
    var db = store.read();
    var body = req.body || {};
    var result = ledger.recordSettlement(
      db,
      req.params.id,
      body.amount,
      body.mode || 'upi',
      body.note || '',
      String(body.requestId || '').trim()
    );

    if (!result.ok) return res.status(400).json({ error: result.error });
    if (!result.duplicate) {
      store.appendAudit(
        db,
        'KHATA_SETTLEMENT',
        result.customer.name + ' settled ₹' + result.settlement.amount + ' via ' + (body.mode || 'upi').toUpperCase()
      );
      store.write(db);
    }
    res.status(result.duplicate ? 200 : 201).json(result);
  });
});

module.exports = router;
