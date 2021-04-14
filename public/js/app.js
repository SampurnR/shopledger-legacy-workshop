var allProducts = [];
var cartQuantities = {}; // productId -> qty
var activeCategory = 'all';
var customersList = [];

function get(url, cb) {
  var x = new XMLHttpRequest();
  x.open('GET', url);
  x.onload = function () {
    try {
      cb(JSON.parse(x.responseText), x.status);
    } catch (e) {
      cb(null, x.status);
    }
  };
  x.send();
}

function post(url, data, cb) {
  var x = new XMLHttpRequest();
  x.open('POST', url);
  x.setRequestHeader('Content-Type', 'application/json');
  x.onload = function () {
    var parsed = {};
    try {
      parsed = JSON.parse(x.responseText);
    } catch (e) {
      parsed = { error: x.responseText || 'Request failed' };
    }
    cb(x.status, parsed);
  };
  x.send(JSON.stringify(data));
}

function fmtMoney(n) {
  var val = Number(n || 0);
  return '₹' + val.toFixed(2);
}

function loadDashboardSummary() {
  get('/api/reports/dashboard', function (data) {
    if (!data || !data.summary) return;
    var s = data.summary;

    document.getElementById('kpi-revenue').textContent = fmtMoney(s.grossRevenue);
    document.getElementById('kpi-tax').textContent =
      'GST Collected: ' + fmtMoney(s.totalTaxCollected) + ' · Discounts: ' + fmtMoney(s.totalDiscountGiven);

    document.getElementById('kpi-orders').textContent = s.totalOrders + ' Orders';
    document.getElementById('kpi-orders-sub').textContent =
      s.activeOrdersCount + ' active · ' + s.pendingCount + ' pending · ' + s.cancelledCount + ' cancelled';

    document.getElementById('kpi-khata').textContent = fmtMoney(s.totalKhataReceivable);

    var inv = s.inventory || {};
    document.getElementById('kpi-stock').textContent = (inv.totalSkus || 0) + ' SKUs';
    document.getElementById('kpi-stock-sub').textContent =
      (inv.outOfStockCount || 0) + ' out of stock · ' + (inv.lowStockCount || 0) + ' low stock';

    document.getElementById('badge-orders').textContent = s.totalOrders;

    var alertBtn = document.getElementById('recon-alert-btn');
    var alertText = document.getElementById('recon-alert-text');
    var badgeAudit = document.getElementById('badge-audit');

    if (s.reconciliationMismatchCount > 0) {
      alertBtn.className = 'alert-chip';
      alertText.textContent = s.reconciliationMismatchCount + ' Invoice GST Mismatches (Δ ' + fmtMoney(s.reconciliationTotalDelta) + ')';
      badgeAudit.className = 'tab-badge warn';
      badgeAudit.textContent = s.reconciliationMismatchCount;
    } else {
      alertBtn.className = 'alert-chip ok';
      alertText.textContent = 'Invoices & Ledger Balanced';
      badgeAudit.className = 'tab-badge ok';
      badgeAudit.textContent = 'OK';
    }
  });
}

function renderCatalogTable() {
  var search = (document.getElementById('pos-search').value || '').toLowerCase().trim();
  var html = '';

  for (var i = 0; i < allProducts.length; i++) {
    var p = allProducts[i];
    if (activeCategory !== 'all' && p.category !== activeCategory) continue;
    if (search) {
      var match = p.name.toLowerCase().indexOf(search) !== -1 ||
        p.sku.toLowerCase().indexOf(search) !== -1 ||
        String(p.hsn).indexOf(search) !== -1;
      if (!match) continue;
    }

    var sellable = p.sellable != null ? p.sellable : p.stock;
    var stockBadge = '';
    if (sellable <= 0) {
      stockBadge = '<span class="stock-pill out">Out of Stock (0)</span>';
    } else if (sellable <= 2) {
      stockBadge = '<span class="stock-pill low">' + sellable + ' Left (Low)</span>';
    } else {
      stockBadge = '<span class="stock-pill in">' + sellable + ' Available</span>';
    }

    var reservedNote = p.reserved ? '<div class="prod-cat">Physical: ' + p.stock + ' · Reserved: ' + p.reserved + '</div>' : '';
    var curQty = cartQuantities[p.id] || 0;

    html += '<tr>' +
      '<td><div><span class="sku-code">' + p.sku + '</span><span class="prod-name">' + p.name + '</span></div>' +
      '<div class="prod-cat">' + p.category + ' · per ' + (p.unit || 'unit') + '</div></td>' +
      '<td><span class="hsn-badge">HSN ' + p.hsn + '</span><span class="gst-badge">' + p.gstPercent + '% GST</span></td>' +
      '<td class="r"><strong>' + fmtMoney(p.price) + '</strong></td>' +
      '<td class="r">' + stockBadge + reservedNote + '</td>' +
      '<td class="c">' +
      '<div class="qty-stepper">' +
      '<button type="button" class="qty-btn" onclick="stepQty(' + p.id + ', -1)">-</button>' +
      '<input type="number" min="0" value="' + curQty + '" id="qty-' + p.id + '" onchange="onQtyInput(' + p.id + ', this.value)">' +
      '<button type="button" class="qty-btn" onclick="stepQty(' + p.id + ', 1)">+</button>' +
      '</div>' +
      '</td>' +
      '</tr>';
  }

  if (!html) {
    html = '<tr><td colspan="5" class="c" style="padding:24px;color:#64748b">No products match the current filter.</td></tr>';
  }

  document.querySelector('#products tbody').innerHTML = html;
}

window.stepQty = function (productId, delta) {
  var current = parseInt(cartQuantities[productId] || 0, 10);
  var next = Math.max(0, current + delta);
  cartQuantities[productId] = next;
  var input = document.getElementById('qty-' + productId);
  if (input) input.value = next;
  updateCartPreview();
};

window.onQtyInput = function (productId, rawVal) {
  var val = parseInt(rawVal, 10);
  if (isNaN(val) || val < 0) val = 0;
  cartQuantities[productId] = val;
  updateCartPreview();
};

function getSelectedCartItems() {
  var items = [];
  for (var i = 0; i < allProducts.length; i++) {
    var p = allProducts[i];
    var q = parseInt(cartQuantities[p.id] || 0, 10);
    if (q > 0) {
      items.push({
        id: p.id,
        name: p.name,
        price: p.price,
        qty: q
      });
    }
  }
  return items;
}

function updateCartPreview() {
  var items = getSelectedCartItems();
  var countEl = document.getElementById('cart-count');
  var listEl = document.getElementById('cart-items-list');
  var feedbackEl = document.getElementById('coupon-feedback');
  var couponCode = document.getElementById('coupon').value;

  var totalUnits = 0;
  for (var i = 0; i < items.length; i++) {
    totalUnits += items[i].qty;
  }
  countEl.textContent = items.length + ' SKUs, ' + totalUnits + ' units';

  if (!items.length) {
    listEl.className = 'cart-items-empty';
    listEl.innerHTML = 'No items selected yet. Adjust quantities in the catalog table.';
    document.getElementById('preview-subtotal').textContent = '₹0.00';
    document.getElementById('preview-discount').textContent = '-₹0.00';
    document.getElementById('preview-tax').textContent = '₹0.00';
    document.getElementById('preview-total').textContent = '₹0.00';
    feedbackEl.textContent = '';
    return;
  }

  var miniHtml = '';
  for (var j = 0; j < items.length; j++) {
    var it = items[j];
    miniHtml += '<div class="cart-mini-item">' +
      '<span>' + it.name + ' &times; ' + it.qty + '</span>' +
      '<strong>' + fmtMoney(it.price * it.qty) + '</strong>' +
      '</div>';
  }
  listEl.className = '';
  listEl.innerHTML = miniHtml;

  post('/api/pricing/preview', { items: items, coupon: couponCode }, function (status, res) {
    if (!res || !res.totals) return;
    var t = res.totals;
    document.getElementById('preview-subtotal').textContent = fmtMoney(t.subtotal);
    document.getElementById('preview-discount').textContent = '-' + fmtMoney(t.discount);
    document.getElementById('preview-tax').textContent = fmtMoney(t.tax);
    document.getElementById('preview-total').textContent = fmtMoney(t.total);

    if (couponCode && res.couponStatus) {
      if (res.couponStatus.valid) {
        feedbackEl.className = 'field-hint ok';
        feedbackEl.textContent = 'Promo applied: saved ' + fmtMoney(t.discount);
      } else {
        feedbackEl.className = 'field-hint err';
        feedbackEl.textContent = res.couponStatus.error;
      }
    } else {
      feedbackEl.textContent = '';
    }
  });
}

function loadProducts() {
  get('/api/products', function (data) {
    if (!data) return;
    allProducts = data;
    renderCatalogTable();
    renderInventoryAuditTable();
  });
}

function loadCustomersDropdown() {
  get('/api/customers', function (data) {
    if (!data || !data.customers) return;
    customersList = data.customers;

    var posSelect = document.getElementById('customer-select');
    var settleSelect = document.getElementById('settle-customer');

    var posOpts = '<option value="">-- Walk-in / Custom Name --</option>';
    var settleOpts = '';

    for (var i = 0; i < customersList.length; i++) {
      var c = customersList[i];
      posOpts += '<option value="' + c.id + '">' + c.name + ' (' + c.type + ' · Due: ' + fmtMoney(c.balance) + ')</option>';
      settleOpts += '<option value="' + c.id + '">' + c.name + ' (Due: ' + fmtMoney(c.balance) + ')</option>';
    }

    posSelect.innerHTML = posOpts;
    settleSelect.innerHTML = settleOpts;

    renderKhataTable(data.customers, data.settlements || []);
  });
}

function loadOrders() {
  var search = document.getElementById('orders-search').value || '';
  var status = document.getElementById('orders-status').value || 'all';
  var from = document.getElementById('orders-from').value || '';
  var to = document.getElementById('orders-to').value || '';

  var qs = '?status=' + encodeURIComponent(status) +
    '&search=' + encodeURIComponent(search) +
    '&from=' + encodeURIComponent(from) +
    '&to=' + encodeURIComponent(to);

  get('/api/orders' + qs, function (data) {
    if (!data) return;
    var html = '';
    for (var i = 0; i < data.length; i++) {
      var o = data[i];
      var itemSummary = (o.items || []).map(function (it) {
        return it.name + ' (' + it.qty + ')';
      }).join(', ');

      var st = o.status || 'completed';
      var cancelBtn = st !== 'cancelled'
        ? ' <button type="button" class="btn btn-danger-outline" onclick="cancelOrder(' + o.id + ')">Cancel</button>'
        : '';

      html += '<tr>' +
        '<td><strong>#' + o.id + '</strong></td>' +
        '<td>' + o.date + '</td>' +
        '<td><strong>' + (o.customer || 'Walk-in') + '</strong></td>' +
        '<td style="max-width:260px;font-size:12px;color:#475569">' + itemSummary + '</td>' +
        '<td><span class="sku-code">' + (o.paymentMode || 'cash').toUpperCase() + '</span></td>' +
        '<td>' + (o.coupon ? '<span class="gst-badge">' + o.coupon + '</span>' : '<span style="color:#94a3b8">-</span>') + '</td>' +
        '<td class="r">' + fmtMoney(o.subtotal) + '</td>' +
        '<td class="r" style="color:#15803d">' + (o.discount ? '-' + fmtMoney(o.discount) : '₹0.00') + '</td>' +
        '<td class="r">' + fmtMoney(o.tax) + '</td>' +
        '<td class="r"><strong>' + fmtMoney(o.total) + '</strong></td>' +
        '<td><span class="status-pill ' + st + '">' + st + '</span></td>' +
        '<td class="r" style="white-space:nowrap">' +
        '<a class="btn-link" href="/orders/' + o.id + '/invoice" target="_blank">Invoice &nearr;</a>' +
        cancelBtn +
        '</td>' +
        '</tr>';
    }

    if (!html) {
      html = '<tr><td colspan="12" class="c" style="padding:24px;color:#64748b">No orders match the selected criteria.</td></tr>';
    }

    document.querySelector('#orders tbody').innerHTML = html;
  });
}

window.cancelOrder = function (orderId) {
  var msgEl = document.getElementById('orders-action-msg');
  post('/api/orders/' + orderId + '/cancel', { reason: 'Cancelled from Order Register' }, function (status, res) {
    if (status === 200) {
      msgEl.className = 'ok';
      msgEl.textContent = 'Order #' + orderId + ' has been marked as cancelled and inventory release was triggered.';
      loadOrders();
      loadProducts();
      loadCustomersDropdown();
      loadDashboardSummary();
    } else {
      msgEl.className = 'err';
      msgEl.textContent = (res && res.error) ? res.error : 'Failed to cancel order';
    }
  });
};

function renderKhataTable(customers, settlements) {
  var html = '';
  for (var i = 0; i < customers.length; i++) {
    var c = customers[i];
    var balColor = c.balance > 0 ? '#b91c1c' : '#15803d';
    html += '<tr>' +
      '<td><strong>' + c.name + '</strong><div class="prod-cat">' + c.phone + '</div></td>' +
      '<td><span class="sku-code">' + c.type + '</span>' +
      (c.gstin ? '<div class="prod-cat">' + c.gstin + '</div>' : '') + '</td>' +
      '<td class="r">' + fmtMoney(c.creditLimit) + '</td>' +
      '<td class="r">' + fmtMoney(c.openingBalance) + '</td>' +
      '<td class="r">' + fmtMoney(c.totalBilled) + '</td>' +
      '<td class="r">' + String(c.totalSettled) + '</td>' +
      '<td class="r"><strong style="color:' + balColor + '">' + fmtMoney(c.balance) + '</strong></td>' +
      '<td class="r"><button type="button" class="btn btn-ghost btn-sm" onclick="prefillSettlement(' + c.id + ')">Settle</button></td>' +
      '</tr>';
  }
  document.querySelector('#customers-table tbody').innerHTML = html;

  var feedHtml = '';
  for (var j = 0; j < settlements.length; j++) {
    var s = settlements[j];
    feedHtml += '<div class="settlement-card">' +
      '<div class="settlement-card-top"><span>' + s.customerName + '</span><span style="color:#15803d">+' + fmtMoney(s.amount) + '</span></div>' +
      '<div class="settlement-card-sub">' + s.date + ' · ' + String(s.mode).toUpperCase() + ' · ' + (s.note || '') + '</div>' +
      '</div>';
  }
  document.getElementById('settlements-list').innerHTML = feedHtml || '<div class="prod-cat">No settlements logged yet.</div>';
}

window.prefillSettlement = function (customerId) {
  document.getElementById('settle-customer').value = String(customerId);
  document.getElementById('settle-amount').focus();
};

function renderInventoryAuditTable() {
  var html = '';
  for (var i = 0; i < allProducts.length; i++) {
    var p = allProducts[i];
    var sellable = p.sellable != null ? p.sellable : p.stock;
    var health = '<span class="stock-pill in">Healthy</span>';
    if (sellable === 0) {
      health = '<span class="stock-pill out">Depleted</span>';
    } else if (sellable <= 2) {
      health = '<span class="stock-pill low">Critical (1-2 Left)</span>';
    } else if (sellable <= p.reorderLevel) {
      health = '<span class="stock-pill low">Below Reorder (' + p.reorderLevel + ')</span>';
    }

    html += '<tr>' +
      '<td><span class="sku-code">' + p.sku + '</span></td>' +
      '<td><strong>' + p.name + '</strong></td>' +
      '<td>' + p.category + '</td>' +
      '<td><span class="hsn-badge">' + p.hsn + '</span></td>' +
      '<td class="r">' + p.gstPercent + '%</td>' +
      '<td class="r">' + fmtMoney(p.price) + '</td>' +
      '<td class="r">' + p.stock + '</td>' +
      '<td class="r">' + (p.reserved || 0) + '</td>' +
      '<td class="r"><strong>' + sellable + '</strong></td>' +
      '<td>' + health + '</td>' +
      '</tr>';
  }
  document.querySelector('#inventory-audit-table tbody').innerHTML = html;
}

function loadGstReconciliation() {
  get('/api/reports/gst-reconciliation', function (data) {
    if (!data || !data.rows) return;
    var pill = document.getElementById('recon-summary-pill');
    if (data.mismatchCount > 0) {
      pill.className = 'status-pill cancelled';
      pill.textContent = data.mismatchCount + ' of ' + data.totalChecked + ' Orders Mismatched (Δ ' + fmtMoney(data.totalDelta) + ')';
    } else {
      pill.className = 'status-pill completed';
      pill.textContent = 'All ' + data.totalChecked + ' Active Invoices Balanced';
    }

    var html = '';
    for (var i = 0; i < data.rows.length; i++) {
      var r = data.rows[i];
      var badge = r.matched
        ? '<span class="status-pill completed">Matched</span>'
        : '<span class="status-pill cancelled">Mismatch</span>';

      var deltaStr = (r.delta > 0 ? '+' : '') + fmtMoney(r.delta);
      var deltaStyle = r.matched ? 'color:#15803d' : 'color:#b91c1c;font-weight:700';

      html += '<tr>' +
        '<td><a class="btn-link" href="/orders/' + r.orderId + '/invoice" target="_blank">#' + r.orderId + ' &nearr;</a></td>' +
        '<td>' + r.date + '</td>' +
        '<td>' + r.customer + '</td>' +
        '<td>' + (r.coupon ? '<span class="gst-badge">' + r.coupon + '</span>' : '-') + '</td>' +
        '<td class="r">' + fmtMoney(r.ledgerSubtotal) + '</td>' +
        '<td class="r">-' + fmtMoney(r.ledgerDiscount) + '</td>' +
        '<td class="r">' + fmtMoney(r.ledgerTax) + '</td>' +
        '<td class="r"><strong>' + fmtMoney(r.ledgerTotal) + '</strong></td>' +
        '<td class="r">-' + fmtMoney(r.invoiceDiscount) + '</td>' +
        '<td class="r">' + fmtMoney(r.invoiceTax) + '</td>' +
        '<td class="r"><strong>' + fmtMoney(r.invoiceTotal) + '</strong></td>' +
        '<td class="r" style="' + deltaStyle + '">' + deltaStr + '</td>' +
        '<td>' + badge + '</td>' +
        '</tr>';
    }
    document.querySelector('#recon-table tbody').innerHTML = html;
  });
}

function showTab(which) {
  var tabs = ['new', 'orders', 'khata', 'audit'];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    document.getElementById('view-' + t).style.display = (t === which) ? '' : 'none';
    document.getElementById('tab-' + t).className = (t === which) ? 'tab-link active' : 'tab-link';
  }
  if (which === 'orders') loadOrders();
  if (which === 'khata') loadCustomersDropdown();
  if (which === 'audit') {
    loadGstReconciliation();
    renderInventoryAuditTable();
  }
}

// Event bindings
document.getElementById('tab-new').onclick = function () { showTab('new'); return false; };
document.getElementById('tab-orders').onclick = function () { showTab('orders'); return false; };
document.getElementById('tab-khata').onclick = function () { showTab('khata'); return false; };
document.getElementById('tab-audit').onclick = function () { showTab('audit'); return false; };
document.getElementById('recon-alert-btn').onclick = function () { showTab('audit'); };

document.getElementById('pos-search').oninput = function () {
  renderCatalogTable();
};

var catButtons = document.querySelectorAll('#pos-categories .cat-pill');
for (var cIdx = 0; cIdx < catButtons.length; cIdx++) {
  catButtons[cIdx].onclick = function () {
    activeCategory = this.getAttribute('data-cat');
    for (var j = 0; j < catButtons.length; j++) {
      catButtons[j].className = 'cat-pill';
    }
    this.className = 'cat-pill active';
    renderCatalogTable();
  };
}

var promoChips = document.querySelectorAll('#promo-chips .promo-chip');
for (var pIdx = 0; pIdx < promoChips.length; pIdx++) {
  promoChips[pIdx].onclick = function () {
    document.getElementById('coupon').value = this.getAttribute('data-code');
    updateCartPreview();
  };
}

document.getElementById('coupon').oninput = function () {
  updateCartPreview();
};

document.getElementById('customer-select').onchange = function () {
  var val = this.value;
  var walkinGroup = document.getElementById('walkin-name-group');
  if (val) {
    walkinGroup.style.display = 'none';
  } else {
    walkinGroup.style.display = '';
  }
};

document.getElementById('clear-cart').onclick = function () {
  cartQuantities = {};
  document.getElementById('coupon').value = '';
  document.getElementById('customer').value = '';
  document.getElementById('customer-select').value = '';
  document.getElementById('walkin-name-group').style.display = '';
  document.getElementById('msg').className = '';
  document.getElementById('msg').innerHTML = '';
  renderCatalogTable();
  updateCartPreview();
};

document.getElementById('place').onclick = function () {
  var items = getSelectedCartItems();
  var msg = document.getElementById('msg');
  if (!items.length) {
    msg.className = 'err';
    msg.innerHTML = 'Pick at least one item from the catalog';
    return;
  }

  var selectedCustId = document.getElementById('customer-select').value;
  var payload = {
    items: items,
    customerId: selectedCustId ? Number(selectedCustId) : null,
    customer: document.getElementById('customer').value,
    paymentMode: document.getElementById('payment-mode').value,
    status: document.getElementById('order-status').value,
    coupon: document.getElementById('coupon').value
  };

  post('/api/orders', payload, function (status, res) {
    if (status === 201) {
      cartQuantities = {};
      msg.className = 'ok';
      msg.innerHTML = '<strong>Order #' + res.id + ' placed!</strong> Ledger Total: ' + fmtMoney(res.total) +
        ' &middot; <a href="/orders/' + res.id + '/invoice" target="_blank">Open GST Invoice &nearr;</a>';
      loadProducts();
      updateCartPreview();
      loadDashboardSummary();
      loadCustomersDropdown();
    } else {
      msg.className = 'err';
      msg.innerHTML = (res && res.error) ? res.error : 'Order failed';
    }
  });
};

document.getElementById('btn-filter-orders').onclick = function () {
  loadOrders();
};

document.getElementById('btn-reset-orders').onclick = function () {
  document.getElementById('orders-search').value = '';
  document.getElementById('orders-status').value = 'all';
  document.getElementById('orders-from').value = '';
  document.getElementById('orders-to').value = '';
  loadOrders();
};

document.getElementById('btn-record-settlement').onclick = function () {
  var custId = document.getElementById('settle-customer').value;
  var amount = document.getElementById('settle-amount').value; // string from input
  var mode = document.getElementById('settle-mode').value;
  var note = document.getElementById('settle-note').value;
  var khataMsg = document.getElementById('khata-msg');

  post('/api/customers/' + custId + '/settle', {
    amount: amount,
    mode: mode,
    note: note
  }, function (status, res) {
    if (status === 201) {
      khataMsg.className = 'ok';
      khataMsg.textContent = 'Recorded settlement for ' + res.customer.name + '. Updated balance: ' + fmtMoney(res.customer.balance);
      document.getElementById('settle-amount').value = '';
      document.getElementById('settle-note').value = '';
      loadCustomersDropdown();
      loadDashboardSummary();
    } else {
      khataMsg.className = 'err';
      khataMsg.textContent = (res && res.error) ? res.error : 'Failed to record settlement';
    }
  });
};

// Initial boot
loadProducts();
loadCustomersDropdown();
loadDashboardSummary();
loadGstReconciliation();
