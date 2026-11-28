const {test,before,after,beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const {start} = require('../qa/fixture');
const config = require('../config');
let shop;
before(async () => { shop = await start(); });
beforeEach(() => shop.reset());
after(() => shop.close());
const cart = {items:[{id:1,qty:1}]};
async function request(path, status, body) {
  const res = await fetch(shop.url + path, body === undefined ? {} : {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
  });
  assert.equal(res.status,status,path);
  return res.headers.get('content-type').includes('application/json') ? res.json() : res.text();
}
for (const search of ['rice','qa-001','1006']) {
  test('catalog search by '+search, async () => {
    const list = await request('/api/products?category=staples%20%26%20grains&search='+search,200);
    assert.equal(list.length,1);
    assert.equal(list[0].sellable,8);
    assert.deepEqual(await request('/api/products?category=Dairy',200),[]);
  });
}
for (const [code,qty,discount,valid] of [
  ['',1,0,true],[' save10 ',1,50,true],['SAVE10',5,150,true],['FLAT50',1,50,true],
  ['WELCOME',4,100,true],['WHOLESALE15',1,0,false],['WHOLESALE15',8,400,true],
  ['MISSING',1,0,false],['DIWALI20',1,0,false]
]) {
  test('preview and checkout '+JSON.stringify([code,qty]),async () => {
    const body={items:[{id:1,qty}],coupon:code};
    const p=await request('/api/pricing/preview',200,body);
    assert.equal(p.couponStatus.valid,valid);
    assert.equal(p.totals.discount,discount);
    const before=shop.snapshot();
    const order=await request('/api/orders',valid?201:400,body);
    if(valid) assert.equal(order.total,p.totals.total);
    else assert.deepEqual(shop.snapshot(),before);
  });
}
for(const mode of ['cash','upi','khata']) {
  test(mode+' sale, invoice, history, reports and cancellation',async () => {
    const order=await request('/api/orders',201,{...cart,paymentMode:mode,customerId:1,status:'pending'});
    assert.equal(order.total,525);
    assert.equal(shop.snapshot().products[0].stock,9);
    assert.equal((await request('/api/customers',200)).customers[0].balance,mode==='khata'?625:100);
    assert.deepEqual(await request('/api/orders?status=pending&search=QA',200),[order]);
    assert.deepEqual(await request('/api/orders/'+order.id,200),order);
    assert.match(await request('/orders/'+order.id+'/invoice',200),/₹525\.00/);
    assert.equal((await request('/api/reports/gst-reconciliation',200)).mismatchCount,0);
    assert.equal((await request('/api/reports/dashboard',200)).summary.grossRevenue,525);
    await request('/api/orders/'+order.id+'/cancel',200,{});
    const db=shop.snapshot();
    assert.equal(db.products[0].stock,10);
    assert.equal(db.customers[0].totalBilled,100);
    assert.equal(db.auditLog.length,2);
    assert.equal((await request('/api/reports/gst-reconciliation',200)).totalChecked,0);
    await request('/api/orders/'+order.id+'/cancel',400,{});
    assert.deepEqual(shop.snapshot(),db);
  });
}
for(const [name,body,status] of [
  ['empty',{},400],['unknown SKU',{items:[{id:99,qty:1}]},400],
  ['oversell',{items:[{id:1,qty:9}]},409],['duplicate lines oversell',{items:[{id:1,qty:5},{id:1,qty:4}]},409],
  ['missing account',{...cart,paymentMode:'khata'},400],['unknown account',{...cart,paymentMode:'khata',customerId:88},409],
  ['credit limit',{items:[{id:1,qty:2}],paymentMode:'khata',customerId:1},409]
]) test(name+' leaves ledger and inventory intact',async () => {
  const before=shop.snapshot(); await request('/api/orders',status,body); assert.deepEqual(shop.snapshot(),before);
});
for(const amount of [0,-1,'abc',null]) test('invalid settlement '+amount,async () => {
  const before=shop.snapshot(); await request('/api/customers/1/settle',400,{amount}); assert.deepEqual(shop.snapshot(),before);
});
test('decimal settlement persists with mode, note, history and audit',async () => {
  const r=await request('/api/customers/1/settle',201,{amount:'12.35',mode:'cash',note:'QA'});
  assert.equal(r.customer.balance,87.65);
  const {settlements}=await request('/api/customers',200);
  assert.equal(settlements[0].note,'QA'); assert.equal(settlements[0].amount,12.35);
  assert.equal(settlements[0].mode,'cash'); assert.equal(shop.snapshot().auditLog[0].action,'KHATA_SETTLEMENT');
});
test('missing resources and active coupon list',async () => {
  await request('/api/orders/99',404); await request('/orders/99/invoice',404);
  await request('/api/orders/99/cancel',400,{}); await request('/api/customers/99/settle',400,{amount:5});
  const codes=(await request('/api/coupons',200)).map(c=>c.code);
  assert.ok(codes.includes('SAVE10')); assert.ok(!codes.includes('DIWALI20'));
});
test('export permission and contents',async () => {
  await request('/api/admin/export',403);
  assert.deepEqual(await request('/api/admin/export?key='+encodeURIComponent(config.adminKey),200),shop.snapshot());
});
for (const qty of [0,-1,1.5]) test('checkout rejects invalid quantity '+qty,async () => {
  const before=shop.snapshot();
  await request('/api/orders',400,{items:[{id:1,qty}]});
  assert.deepEqual(shop.snapshot(),before);
});
