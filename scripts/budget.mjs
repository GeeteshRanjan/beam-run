/**
 * Shared bundle-budget policy (pure, testable).
 *
 * The hard performance budget from the Ops doc, plus the pure evaluation used
 * by the CI gate (`check-budget.mjs`) and its unit test (`budget.test.mjs`).
 * Budgets are gzipped kilobytes.
 */
export const BUDGETS = {
  jsGzipKB: 90,
  totalGzipKB: 250,
};

/**
 * Evaluate sizes against the budget.
 * @param {number} jsGzKB total gzipped JS payload
 * @param {number} totalGzKB total gzipped payload (JS + assets)
 * @param {{jsGzipKB:number,totalGzipKB:number}} budgets
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function evaluateBudget(jsGzKB, totalGzKB, budgets = BUDGETS) {
  const problems = [];
  if (jsGzKB > budgets.jsGzipKB) {
    problems.push(`JS ${jsGzKB.toFixed(1)}KB > ${budgets.jsGzipKB}KB gzipped`);
  }
  if (totalGzKB > budgets.totalGzipKB) {
    problems.push(`Total ${totalGzKB.toFixed(1)}KB > ${budgets.totalGzipKB}KB gzipped`);
  }
  return { ok: problems.length === 0, problems };
}
