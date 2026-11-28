const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

exports.start = async function () {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopledger-qa-'));
  for (const name of ['config.js', 'server.js', 'routes', 'lib', 'public']) {
    fs.cpSync(path.join(root, name), path.join(dir, name), {recursive:true});
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
  fs.mkdirSync(path.join(dir, 'data'));
  const dbFile = path.join(dir, 'data/db.json');
  function reset() {
    fs.writeFileSync(dbFile, JSON.stringify({
      products:[{id:1, name:'QA Rice', sku:'QA-001', category:'Staples & Grains', hsn:'1006', price:500, stock:10, reserved:2}],
      customers:[{id:1, name:'QA Customer', totalSettled:0, totalBilled:100, creditLimit:1000}],
      orders:[], settlements:[], auditLog:[], nextOrderId:1001, nextSettlementId:501
    }));
  }
  reset();
  const app = require(path.join(dir, 'server'));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  return {reset, url:'http://127.0.0.1:' + server.address().port,
    snapshot:() => JSON.parse(fs.readFileSync(dbFile)),
    async close() {
      await new Promise(resolve => server.close(resolve));
      fs.unlinkSync(path.join(dir, 'node_modules'));
      fs.rmSync(dir, {recursive:true});
    }
  };
};
