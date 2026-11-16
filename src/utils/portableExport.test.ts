import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJsonBackupPayload,
  buildPortableOfflineAppHtml,
} from './portableExport.ts';
import { ReadableEquation } from '../types.ts';

const SAMPLE: ReadableEquation[] = [
  {
    id: '1',
    title: 'KCL',
    plain: '(V1 - 12)/1k + V1/2k = 0',
    latex: '\\frac{V_1 - 12}{1k} + \\frac{V_1}{2k} = 0',
    source: 'typed',
    createdAt: 1,
  },
];

describe('portableExport offline local HTML and JSON backup', () => {
  it('builds a self-contained HTML file with embedded solver, equations, and zero external scripts', () => {
    const html = buildPortableOfflineAppHtml(SAMPLE);
    assert.ok(html.includes('<!doctype html>'));
    assert.ok(html.includes('Lecture Scratchpad — Local Offline Workbook'));
    assert.ok(html.includes('Solve Matrix System'));
    assert.ok(html.includes('(V1 - 12)/1k + V1/2k = 0'));
    assert.ok(!html.includes('https://cdn.'));
  });

  it('serializes JSON backup cleanly', () => {
    const json = buildJsonBackupPayload(SAMPLE);
    const parsed = JSON.parse(json) as { equations: ReadableEquation[] };
    assert.equal(parsed.equations.length, 1);
    assert.equal(parsed.equations[0].title, 'KCL');
  });
});
