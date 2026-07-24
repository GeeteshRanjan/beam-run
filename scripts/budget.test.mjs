import { describe, it, expect } from 'vitest';
import { BUDGETS, evaluateBudget } from './budget.mjs';

describe('bundle budget gate', () => {
  it('passes when JS and total are within budget', () => {
    const r = evaluateBudget(30, 52);
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it('fails when the JS payload exceeds its gzip budget', () => {
    const r = evaluateBudget(BUDGETS.jsGzipKB + 1, 100);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('JS');
  });

  it('fails when the total payload exceeds its gzip budget', () => {
    const r = evaluateBudget(50, BUDGETS.totalGzipKB + 10);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('Total');
  });
});
