const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

test('staff views display stored names and settlement notes as text', () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {});
    return elements.get(id);
  }
  const context = vm.createContext({
    document: { getElementById: element, querySelector: element, querySelectorAll: () => [] },
    window: {},
    XMLHttpRequest: class { open() {} send() {} }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../public/js/app.js'), 'utf8'), context);

  const name = 'Sam <wholesale> & Co.';
  context.get = (_, callback) => callback([{
    id: 1, customer: name, items: [{ name: 'Tea <bulk>', qty: 1 }]
  }]);
  context.loadOrders();
  assert.match(element('#orders tbody').innerHTML, /Sam &lt;wholesale&gt; &amp; Co\./);
  assert.match(element('#orders tbody').innerHTML, /Tea &lt;bulk&gt;/);

  context.renderKhataTable([], [{ customerName: name, note: 'Paid <in full>' }]);
  assert.match(element('settlements-list').innerHTML, /Paid &lt;in full&gt;/);
});
