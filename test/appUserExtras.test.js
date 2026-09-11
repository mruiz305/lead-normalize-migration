const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  APP_USER_EXTRA_FIELDS,
  coerceExtra,
  toFlag,
  extraParamValues,
  extraSelectSql,
} = require('../src/migration/appUserExtras');

test('toFlag: true/false/numéricos/vacío', () => {
  assert.equal(toFlag(1), 1);
  assert.equal(toFlag('true'), 1);
  assert.equal(toFlag(0), 0);
  assert.equal(toFlag('no'), 0);
  assert.equal(toFlag(null), null);
  assert.equal(toFlag(''), null);
});

test('coerceExtra: special access y T&C', () => {
  const zc = APP_USER_EXTRA_FIELDS.find((f) => f.src === 'hierarchySpecialAccessZc');
  const agreed = APP_USER_EXTRA_FIELDS.find((f) => f.src === 'agreedtoT&C');
  const signed = APP_USER_EXTRA_FIELDS.find((f) => f.src === 'signedtoT&C');
  assert.equal(coerceExtra(zc, { hierarchySpecialAccessZc: ' a@b.com ' }), 'a@b.com');
  assert.equal(coerceExtra(agreed, { 'agreedtoT&C': 1 }), 1);
  assert.equal(
    coerceExtra(signed, { 'signedtoT&C': 'https://storage.googleapis.com/x.png' }),
    'https://storage.googleapis.com/x.png'
  );
});

test('extraParamValues respeta columnas disponibles', () => {
  const row = { hierarchySpecialAccessZc: 'x@y.com', shift: 'AM' };
  const onlyZc = extraParamValues(row, new Set(['hierarchySpecialAccessZc']));
  const zcIdx = APP_USER_EXTRA_FIELDS.findIndex((f) => f.src === 'hierarchySpecialAccessZc');
  const shiftIdx = APP_USER_EXTRA_FIELDS.findIndex((f) => f.src === 'shift');
  assert.equal(onlyZc[zcIdx], 'x@y.com');
  assert.equal(onlyZc[shiftIdx], null);
});

test('extraSelectSql quotea T&C', () => {
  const sql = extraSelectSql(new Set(['agreedtoT&C', 'shift']));
  assert.match(sql, /`agreedtoT&C`/);
  assert.match(sql, /`shift`/);
  assert.doesNotMatch(sql, /hierarchySpecialAccessZc/);
});
