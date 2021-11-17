var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var config = require('./config');
var store = require('./lib/store');
var orders = require('./lib/orders');
var invoice = require('./lib/invoice');

var productRoutes = require('./routes/products');
var orderRoutes = require('./routes/orders');
var customerRoutes = require('./routes/customers');
var reportRoutes = require('./routes/reports');

var app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', customerRoutes);
app.use('/api', reportRoutes);

// Added Nov 2021 (Neha): Printable HTML invoice view for the accountant
app.get('/orders/:id/invoice', function (req, res) {
  var db = store.read();
  var o = orders.get(db, req.params.id);
  if (!o) return res.status(404).send('Order not found');
  res.send(invoice.render(o));
});

// app.get('/api/orders/:id/pdf', function (req, res) { ... });  // never finished

if (require.main === module) {
  app.listen(config.port, function () {
    console.log('ShopLedger listening on http://localhost:' + config.port);
  });
}

module.exports = app;
