import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backspace,
  createEmptyCasioState,
  insertChar,
  insertFraction,
  insertSqrt,
  insertSub,
  insertSup,
  moveLeft,
  moveRight,
  moveVertical,
  parseTextToCasioNodes,
  serializeToLatex,
  serializeToPlain,
} from './casioMathEditor';

function typeKeys(keys: string[]) {
  let st = createEmptyCasioState();
  for (const k of keys) {
    if (k === '/') st = insertFraction(st);
    else if (k === '^') st = insertSup(st);
    else if (k === '_') st = insertSub(st);
    else if (k === 'LEFT') st = moveLeft(st);
    else if (k === 'RIGHT') st = moveRight(st);
    else if (k === 'UP') st = moveVertical(st, 'up');
    else if (k === 'DOWN') st = moveVertical(st, 'down');
    else if (k === 'BS') st = backspace(st);
    else st = insertChar(st, k);
  }
  return st;
}

test('Casio editor turns x/y into a stacked fraction with x above y', () => {
  const st = typeKeys(['x', '/', 'y']);
  assert.equal(st.nodes.length, 1);
  assert.equal(st.nodes[0].type, 'frac');
  assert.equal(serializeToLatex(st.nodes), '\\frac{x}{y}');
  assert.equal(serializeToPlain(st.nodes), 'x/y');
});

test('Casio editor handles parenthesized numerator, powers, sqrt, Greek shortcuts, and arrow navigation', () => {
  const st = typeKeys([
    '(', 'V', '_', '1', 'RIGHT', '-', 'V', '_', '2', 'RIGHT', ')', '/', 'R', '_', '1',
    '=', '0',
  ]);
  assert.equal(serializeToLatex(st.nodes), '\\frac{V_{1} - V_{2}}{R_{1}} = 0');
  assert.equal(serializeToPlain(st.nodes), '(V1 - V2)/R1 = 0');

  const sq = typeKeys(['s', 'q', 'r', 't', '(', 'x', '^', '2', 'RIGHT', '+', '1', ')']);
  assert.equal(serializeToLatex(sq.nodes), '\\sqrt{x^{2} + 1}');
  assert.equal(serializeToPlain(sq.nodes), 'sqrt(x^2 + 1)');

  const greek = typeKeys([':', 'w', '*', 'L']);
  assert.equal(serializeToLatex(greek.nodes), '\\omega \\cdot L');

  // Up/Down navigation inside fraction and Backspace unwrap
  let nav = typeKeys(['a', '/', 'b', 'UP', '2', 'DOWN', 'BS', 'BS']);
  assert.equal(serializeToLatex(nav.nodes), 'a2');

  let sqBtn = insertSqrt(createEmptyCasioState());
  sqBtn = insertChar(sqBtn, '9');
  assert.equal(serializeToLatex(sqBtn.nodes), '\\sqrt{9}');
});

test('parseTextToCasioNodes round-trips KCL and Quadratic formulas into Casio stacked fractions', () => {
  const kcl = parseTextToCasioNodes('(V1 - Vs)/R1 + (V1 - V2)/R2 = 0');
  assert.equal(
    serializeToLatex(kcl),
    '\\frac{V_{1} - V_{s}}{R_{1}} + \\frac{V_{1} - V_{2}}{R_{2}} = 0'
  );

  const quad = parseTextToCasioNodes('x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)');
  assert.equal(
    serializeToLatex(quad),
    'x = \\frac{-b + \\sqrt{b^{2} - 4 \\cdot a \\cdot c}}{2 \\cdot a}'
  );
});
