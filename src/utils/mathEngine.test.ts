import test from 'node:test';
import assert from 'node:assert/strict';
import { expandSymbolShortcut } from './shortcuts';
import { evaluateNotebookLines, expressionToLatex } from './mathEngine';

test('Greek and EE symbol shortcuts expand cleanly without corrupting numbers', () => {
  const r1 = expandSymbolShortcut(':w', 2);
  assert.equal(r1.nextText, 'ω');
  assert.equal(r1.expanded, true);

  const r2 = expandSymbolShortcut('2*pi*f + :th', 12);
  assert.equal(r2.nextText, '2*pi*f + θ');

  const r3 = expandSymbolShortcut('R1 = 100 :ohm', 13);
  assert.equal(r3.nextText, 'R1 = 100 Ω');

  const r4 = expandSymbolShortcut('C = 10:mu', 9);
  assert.equal(r4.expanded, false);

  const r5 = expandSymbolShortcut('C = 10 * :mu', 12);
  assert.equal(r5.nextText, 'C = 10 * μ');
});

test('Engineering notation and phasor preprocessing evaluate accurately', () => {
  const lines = [
    { id: '1', text: 'R1 = 4.7k' },
    { id: '2', text: 'C1 = 10u' },
    { id: '3', text: 'I1 = 2.2m' },
    { id: '4', text: 'V = I1 * R1' },
    { id: '5', text: 'Vp = 10∠30°' },
    { id: '6', text: 'Z = 3 + 4j' },
    { id: '7', text: 'Rpar = 100 ∥ 100' },
  ];

  const { results } = evaluateNotebookLines(lines);
  assert.equal(results[0].displayValue, '4700');
  assert.equal(results[1].displayValue, '0.00001');
  assert.equal(results[2].displayValue, '0.0022');
  assert.equal(Number(results[3].displayValue).toFixed(2), '10.34');
  assert.equal(results[4].isComplex, true);
  assert.match(results[4].secondaryValue ?? '', /10 ∠ 30°/);
  assert.equal(results[5].displayValue, '3 + 4j');
  assert.equal(results[6].displayValue, '50');
});

test('KaTeX expression converter transforms plain math syntax cleanly', () => {
  const tex = expressionToLatex('V1/R1 + (V1-V2)/R2 = 0');
  assert.equal(tex, '\\frac{V_1}{R_1} + \\frac{V_1-V_2}{R_2} = 0');

  const tex2 = expressionToLatex('sqrt(x^2 + ω^2)');
  assert.equal(tex2, '\\sqrt{x^{2} + \\omega ^{2}}');
});
