'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var dates = require('../lib/dates');

test('ISO date retains a chronological comparison key', function () {
  assert.equal(dates.normalizeDateKey('2022-01-05'), '2022-01-05');
});

test('stored day-first date becomes the equivalent chronological key', function () {
  assert.equal(dates.normalizeDateKey('05/01/2022'), '2022-01-05');
});

test('comparison keys trim input and pad single-digit date components', function () {
  assert.equal(dates.normalizeDateKey(' 5/1/2022 '), '2022-01-05');
  assert.equal(dates.normalizeDateKey(' 2022-1-5 '), '2022-01-05');
});

test('unsupported comparison input is preserved', function () {
  assert.equal(dates.normalizeDateKey('unknown'), 'unknown');
});

test('empty comparison inputs return an empty key', function () {
  [undefined, null, '', '  '].forEach(function (value) {
    assert.equal(dates.normalizeDateKey(value), '');
  });
});

test('today retains the DD/MM/YYYY display format', function () {
  assert.match(dates.today(), /^\d{2}\/\d{2}\/\d{4}$/);
});

test('fiscal year preserves the March/April boundary for both date formats', function () {
  ['31/03/2022', '2022-03-31'].forEach(function (value) {
    assert.equal(dates.getFiscalYear(value), 'FY21-22');
  });
  ['01/04/2022', '2022-04-01'].forEach(function (value) {
    assert.equal(dates.getFiscalYear(value), 'FY22-23');
  });
});

test('missing or unsupported fiscal-year input retains the fallback', function () {
  assert.equal(dates.getFiscalYear(''), 'FY21-22');
  assert.equal(dates.getFiscalYear('not-a-date-value'), 'FY21-22');
});
