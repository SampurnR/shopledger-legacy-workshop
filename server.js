var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var config = require('./config');
var productRoutes = require('./routes/products');
var orderRoutes = require('./routes/orders');

var app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', productRoutes);
app.use('/api', orderRoutes);

if (require.main === module) {
  app.listen(config.port, function () {
    console.log('ShopLedger listening on http://localhost:' + config.port);
  });
}

module.exports = app;
