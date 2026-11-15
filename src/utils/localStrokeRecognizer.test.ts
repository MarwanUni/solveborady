import test from 'node:test';
import assert from 'node:assert/strict';
import { Stroke } from '../types';
import { recognizeStrokesLocally } from './localStrokeRecognizer';

test('recognizeStrokesLocally parses the sample handwritten KCL fraction equation offline', () => {
  const sampleStrokes: Stroke[] = [
    { mode: 'pen', width: 3.2, points: [{ x: 64, y: 80 }, { x: 76, y: 120 }, { x: 90, y: 80 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 102, y: 106 }, { x: 108, y: 100 }, { x: 108, y: 126 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 58, y: 138 }, { x: 120, y: 138 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 64, y: 186 }, { x: 64, y: 150 }, { x: 84, y: 150 }, { x: 84, y: 168 }, { x: 64, y: 168 }, { x: 86, y: 186 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 100, y: 174 }, { x: 106, y: 168 }, { x: 106, y: 192 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 144, y: 138 }, { x: 172, y: 138 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 158, y: 124 }, { x: 158, y: 152 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 198, y: 80 }, { x: 210, y: 120 }, { x: 224, y: 80 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 232, y: 104 }, { x: 244, y: 102 }, { x: 246, y: 112 }, { x: 232, y: 126 }, { x: 248, y: 126 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 192, y: 138 }, { x: 256, y: 138 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 198, y: 186 }, { x: 198, y: 150 }, { x: 218, y: 150 }, { x: 218, y: 168 }, { x: 198, y: 168 }, { x: 220, y: 186 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 232, y: 172 }, { x: 244, y: 170 }, { x: 246, y: 180 }, { x: 232, y: 192 }, { x: 248, y: 192 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 280, y: 132 }, { x: 308, y: 132 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 280, y: 146 }, { x: 308, y: 146 }] },
    { mode: 'pen', width: 3.2, points: [{ x: 338, y: 118 }, { x: 326, y: 130 }, { x: 326, y: 150 }, { x: 338, y: 158 }, { x: 350, y: 148 }, { x: 350, y: 128 }, { x: 338, y: 118 }] },
  ];

  const out = recognizeStrokesLocally(sampleStrokes);
  assert.equal(out.length, 1);
  assert.equal(out[0].plain, 'V1/R1 + V2/R2 = 0');
  assert.equal(out[0].latex, '\\frac{V_1}{R_1} + \\frac{V_2}{R_2} = 0');
});

test('recognizeStrokesLocally handles simple linear expression and ignores empty/eraser-only input', () => {
  assert.deepEqual(
    recognizeStrokesLocally([{ mode: 'eraser', width: 20, points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }]),
    []
  );

  const simple: Stroke[] = [
    // V
    { mode: 'pen', width: 3, points: [{ x: 20, y: 40 }, { x: 32, y: 80 }, { x: 44, y: 40 }] },
    // -
    { mode: 'pen', width: 3, points: [{ x: 64, y: 60 }, { x: 90, y: 60 }] },
    // 0
    { mode: 'pen', width: 3, points: [{ x: 120, y: 40 }, { x: 110, y: 55 }, { x: 110, y: 75 }, { x: 120, y: 82 }, { x: 130, y: 74 }, { x: 130, y: 50 }, { x: 120, y: 40 }] },
    // =
    { mode: 'pen', width: 3, points: [{ x: 150, y: 55 }, { x: 175, y: 55 }] },
    { mode: 'pen', width: 3, points: [{ x: 150, y: 68 }, { x: 175, y: 68 }] },
    // 1
    { mode: 'pen', width: 3, points: [{ x: 200, y: 40 }, { x: 200, y: 82 }] },
  ];

  const res = recognizeStrokesLocally(simple);
  assert.equal(res.length, 1);
  assert.equal(res[0].plain, 'V - 0 = 1');
});
