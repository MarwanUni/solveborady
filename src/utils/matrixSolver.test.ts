import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { solveLinearSystem } from './matrixSolver.ts';

describe('solveLinearSystem matrix solver', () => {
  it('solves a unique 2x2 and KCL circuit system in matrix form', () => {
    const res = solveLinearSystem(['2*x + y = 5', 'x - y = 1']);
    assert.equal(res.status, 'unique');
    assert.deepEqual(res.variables, ['x', 'y']);
    assert.equal(res.uniqueSolution?.x, 2);
    assert.equal(res.uniqueSolution?.y, 1);
    assert.ok(res.latexMatrixEq?.includes('\\begin{bmatrix}'));
    assert.ok(res.latexSolution?.includes('2'));

    const kcl = solveLinearSystem([
      'Vs = 12',
      'R1 = 1k',
      'R2 = 2k',
      'R3 = 2k',
      '(V1 - Vs)/R1 + (V1 - V2)/R2 = 0',
      '(V2 - V1)/R2 + V2/R3 = 0',
    ]);
    assert.equal(kcl.status, 'unique');
    assert.ok(Math.abs((kcl.uniqueSolution?.V1 ?? 0) - 9.6) < 1e-6);
    assert.ok(Math.abs((kcl.uniqueSolution?.V2 ?? 0) - 4.8) < 1e-6);
  });

  it('finds parametric matrix form and many satisfying sample solutions when underdetermined', () => {
    const res = solveLinearSystem(['x + y + z = 6', '2*x - y + z = 3']);
    assert.equal(res.status, 'infinite');
    assert.equal(res.freeCols.length, 1);
    assert.ok((res.sampleSolutions?.length ?? 0) >= 3);
    // Verify every generated sample solution satisfies both equations
    for (const sample of res.sampleSolutions ?? []) {
      const { x, y, z } = sample.values;
      assert.ok(Math.abs(x + y + z - 6) < 1e-7);
      assert.ok(Math.abs(2 * x - y + z - 3) < 1e-7);
    }
  });

  it('returns status none (nothing) when equations are inconsistent', () => {
    const res = solveLinearSystem(['x + y = 4', '2*x + 2*y = 10']);
    assert.equal(res.status, 'none');
    assert.equal(res.uniqueSolution, undefined);
    assert.ok(res.latexSolution?.includes('\\emptyset'));
  });

  it('reports nonlinear equations cleanly', () => {
    const res = solveLinearSystem(['x^2 + y = 4', 'x - y = 0']);
    assert.equal(res.status, 'error');
    assert.match(res.errorMessage ?? '', /nonlinear/i);
  });
});
