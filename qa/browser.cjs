const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const {start} = require('./fixture');

async function run() {
  const shop = await start();
  let browser;
  try {
    browser = await chromium.launch({channel:'msedge'});
    for (const width of [1440,390]) {
      shop.reset();
      const context = await browser.newContext({viewport:{width,height:900}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('dialog',dialog=>dialog.accept());
      await page.goto(shop.url);
      await page.locator('#qty-1').waitFor();
      await page.locator('#place').click();
      await page.locator('#msg.err').waitFor();
      await page.locator('#pos-search').fill('absent');
      assert.match(await page.locator('#products tbody').innerText(),/No products/);
      await page.locator('#pos-search').fill('QA-001');
      await page.locator('[data-cat="Dairy & Ghee"]').click();
      assert.match(await page.locator('#products tbody').innerText(),/No products/);
      await page.locator('[data-cat="all"]').click();
      await page.locator('#products .qty-btn').last().click();
      await page.locator('#clear-cart').click();
      assert.equal(await page.locator('#qty-1').inputValue(),'0');
      await page.locator('#products .qty-btn').last().click();
      if(width===390) await page.locator('.bill-shortcut').click();
      await page.locator('[data-code="SAVE10"]').click();
      await page.waitForFunction(()=>document.querySelector('#preview-total').textContent.includes('472.50'));
      await page.locator('#customer-select').selectOption('1');
      await page.locator('#payment-mode').selectOption('khata');
      await page.locator('#order-status').selectOption('pending');
      await page.locator('#place').click();
      await page.locator('#msg.ok a').waitFor();
      const invoice = await page.context().newPage();
      await invoice.goto(new URL(await page.locator('#msg.ok a').getAttribute('href'),shop.url).href);
      assert.match(await invoice.locator('body').innerText(),/472\.50/);
      await invoice.close();
      await page.locator('#tab-orders').click();
      await page.locator('#orders-search').fill('absent');
      await page.locator('#btn-filter-orders').click();
      await page.waitForFunction(()=>!document.querySelector('#orders tbody').textContent.includes('1001'));
      await page.locator('#btn-reset-orders').click();
      await page.locator('#orders button').first().click();
      await page.waitForFunction(()=>document.querySelector('#orders tbody').textContent.toLowerCase().includes('cancelled'));
      await page.locator('#tab-khata').click();
      await page.locator('#settle-customer').selectOption('1');
      await page.locator('#settle-amount').fill('25.50');
      await page.locator('#btn-record-settlement').click();
      await page.locator('#khata-msg.ok').waitFor();
      assert.match(await page.locator('#khata-msg').innerText(),/74\.50/);
      await page.locator('#recon-alert-btn').click();
      await page.locator('#inventory-audit-table tbody tr').first().waitFor();
      assert.equal(shop.snapshot().products[0].stock,10);
      assert.equal(shop.snapshot().orders.length,1);
      assert.deepEqual(errors,[]);
      console.log(width+'px: catalog, empty cart, clear, coupon, checkout, invoice, history, cancellation, settlement and audit passed');
      await context.close();
    }
  } finally { if(browser) await browser.close(); await shop.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
