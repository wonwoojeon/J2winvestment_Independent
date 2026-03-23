import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatZeroableNumberInput,
  journalFormTone,
  parseNumberInputValue,
} from '../../src/lib/journalFormFields.ts';

test('formatZeroableNumberInput renders zero as an empty field', () => {
  assert.equal(formatZeroableNumberInput(0), '');
  assert.equal(formatZeroableNumberInput(undefined), '');
  assert.equal(formatZeroableNumberInput(12), '12');
  assert.equal(formatZeroableNumberInput(12.5), '12.5');
});

test('parseNumberInputValue converts empty and invalid values to zero', () => {
  assert.equal(parseNumberInputValue(''), 0);
  assert.equal(parseNumberInputValue('  '), 0);
  assert.equal(parseNumberInputValue('10'), 10);
  assert.equal(parseNumberInputValue('10.5'), 10.5);
  assert.equal(parseNumberInputValue('abc'), 0);
});

test('journal form tone includes explicit light and dark contrast classes', () => {
  assert.match(journalFormTone.pageShell, /\bfrom-slate-50\b/);
  assert.match(journalFormTone.pageShell, /\bdark:from-slate-950\b/);
  assert.match(journalFormTone.input, /\bbg-white\b/);
  assert.match(journalFormTone.input, /\btext-slate-950\b/);
  assert.match(journalFormTone.input, /\bdark:bg-slate-800\b/);
  assert.match(journalFormTone.input, /\bdark:text-white\b/);
  assert.match(journalFormTone.panel, /\bbg-white\/90\b/);
  assert.match(journalFormTone.panel, /\bdark:bg-slate-900\b/);
});
