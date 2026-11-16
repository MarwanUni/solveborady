import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadableEquation } from '../types';
import {
  buildDownloadPayload,
  extractContextSymbols,
  formatAllEquationsForCopy,
  formatEquationForCopy,
} from './mathContext';

test('extractContextSymbols collects recurring variable and subscript names', () => {
  const eqs: ReadableEquation[] = [
    {
      id: '1',
      plain: '(V1 - Vs)/R1 + (V1 - V2)/R2 = 0',
      latex: '\\frac{V_1 - V_s}{R_1} + \\frac{V_1 - V_2}{R_2} = 0',
      source: 'handwritten',
      createdAt: 1,
    },
    {
      id: '2',
      plain: 'V1 = sqrt(5)',
      latex: 'V_1 = \\sqrt{5}',
      source: 'typed',
      createdAt: 2,
    },
  ];

  const syms = extractContextSymbols(eqs);
  assert.ok(syms.includes('V1'));
  assert.ok(syms.includes('V_1'));
  assert.ok(syms.includes('R1'));
  assert.ok(!syms.includes('sqrt'));
  assert.ok(syms.every((s) => !s.endsWith('}')));
});

test('formatEquationForCopy produces LaTeX, Markdown $$, and Word MathML', () => {
  const tex = '\\frac{V_1}{R_1} = 2';

  assert.equal(formatEquationForCopy(tex, 'latex'), tex);
  assert.equal(formatEquationForCopy(tex, 'markdown'), `$$\n${tex}\n$$`);

  const mathml = formatEquationForCopy(tex, 'mathml');
  assert.ok(mathml.startsWith('<math '));
  assert.ok(mathml.includes('<mfrac>'));
  assert.ok(mathml.endsWith('</math>'));

  const batch = formatAllEquationsForCopy(
    [
      { id: '1', plain: 'x = 1', latex: 'x = 1', source: 'typed', createdAt: 1 },
      { id: '2', plain: 'y = 2', latex: 'y = 2', source: 'typed', createdAt: 2 },
    ],
    'markdown'
  );
  assert.equal(batch, '$$\nx = 1\n$$\n\n$$\ny = 2\n$$');
});

test('buildDownloadPayload creates valid .tex, .md, and offline .html files', () => {
  const eqs: ReadableEquation[] = [
    {
      id: '1',
      title: 'Ohm Law',
      plain: 'V = I * R',
      latex: 'V = I R',
      source: 'typed',
      createdAt: 1,
    },
  ];

  const texFile = buildDownloadPayload(eqs, 'latex');
  assert.equal(texFile.filename, 'lecture-equations.tex');
  assert.ok(texFile.content.includes('\\documentclass{article}'));
  assert.ok(texFile.content.includes('\\[ V = I R \\]'));

  const mdFile = buildDownloadPayload(eqs, 'markdown');
  assert.equal(mdFile.filename, 'lecture-equations.md');
  assert.ok(mdFile.content.includes('## Ohm Law'));
  assert.ok(mdFile.content.includes('$$\nV = I R\n$$'));

  const htmlFile = buildDownloadPayload(eqs, 'mathml');
  assert.equal(htmlFile.filename, 'lecture-equations.html');
  assert.ok(htmlFile.content.includes('<!doctype html>'));
  assert.ok(htmlFile.content.includes('<math '));
  assert.ok(htmlFile.content.includes('Ohm Law'));
});
