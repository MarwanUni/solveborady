import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCasioCalculation,
  extractCalculatorVariables,
} from './casioCalculator';

test('extractCalculatorVariables separates assignment target from formula inputs', () => {
  const quad = extractCalculatorVariables(
    'x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)'
  );
  assert.equal(quad.mode, 'assignment');
  assert.equal(quad.targetVar, 'x');
  assert.deepEqual(quad.variables, ['b', 'a', 'c']);

  const kcl = extractCalculatorVariables('(V1 - Vs)/R1 + (V1 - V2)/R2 = 0');
  assert.equal(kcl.mode, 'equation');
  assert.deepEqual(kcl.variables, ['V1', 'Vs', 'R1', 'V2', 'R2']);
});

test('evaluateCasioCalculation computes numeric expressions and formula substitutions', () => {
  const arith = evaluateCasioCalculation('5/2 + sqrt(3^2 + 4^2)', {});
  assert.equal(arith.status, 'evaluated');
  assert.equal(arith.value, '7.5');

  const quad = evaluateCasioCalculation(
    'x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)',
    { a: '1', b: '-5', c: '6' }
  );
  assert.equal(quad.status, 'evaluated');
  assert.equal(quad.targetVar, 'x');
  assert.equal(quad.value, '3');
});

test('evaluateCasioCalculation solves 1-unknown linear circuit equations with engineering units', () => {
  // Leave V1 blank; provide Vs = 12, R1 = 1k, R2 = 1k, V2 = 0 -> V1 = 6
  const solved = evaluateCasioCalculation(
    '(V1 - Vs)/R1 + (V1 - V2)/R2 = 0',
    { Vs: '12', R1: '1k', R2: '1k', V2: '0' }
  );
  assert.equal(solved.status, 'solved');
  assert.equal(solved.targetVar, 'V1');
  assert.equal(solved.value, '6');
});
