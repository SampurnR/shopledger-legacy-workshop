const test = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../lib/dates');

test('CURRENT BEHAVIOUR: date-picker values become day-first comparison keys', () => {
  assert.equal(dates.normalizeDateKey('2022-01-01'), '01/01/2022');
  assert.equal(dates.normalizeDateKey('2022-01-31'), '31/01/2022');
  assert.equal(dates.normalizeDateKey(' 30/01/2022 '), '30/01/2022');
  assert.equal(dates.normalizeDateKey('2022-03-15') < dates.normalizeDateKey('2021-12-28'), true);
});

test('CURRENT BEHAVIOUR: missing dates become empty keys and malformed dates are not validated', () => {
  for (const value of [undefined, null, '', 0]) {
    assert.equal(dates.normalizeDateKey(value), '');
  }
  assert.equal(dates.normalizeDateKey('not-a-date'), 'date/a/not');
  assert.equal(dates.normalizeDateKey('2022-13-40'), '40/13/2022');
  assert.equal(dates.normalizeDateKey('2022-01'), '2022-01');
});
