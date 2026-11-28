var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var config = require('./config');
var store = require('./lib/store');
var orders = require('./lib/orders');
var invoice = require('./lib/invoice');
var access = require('./lib/access');

var productRoutes = require('./routes/products');
var orderRoutes = require('./routes/orders');
var customerRoutes = require('./routes/customers');
var reportRoutes = require('./routes/reports');

var app = express();
app.disable('x-powered-by');
app.use(function (req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  next();
});
app.use(access.requireStaff);
app.use('/api', function (req, res, next) {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({ error: 'Send an application/json request' });
  }
  next();
});
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
  if (o.heldForDispatch) return res.status(409).send('Complete the order before printing its tax invoice');
  res.send(invoice.render(o));
});

// app.get('/api/orders/:id/pdf', function (req, res) { ... });  // never finished

app.use(function (err, req, res, next) {
  if (err.code === 'STORE_CONFLICT') return res.status(409).json({ error: err.message });
  next(err);
});

if (require.main === module) {
  var host = process.env.HOST || '127.0.0.1';
  app.listen(config.port, host, function () {
    console.log('ShopLedger listening on ' + host + ':' + config.port);
  });
}

module.exports = app;
