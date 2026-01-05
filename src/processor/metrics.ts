import { Transaction, MonthlyMetrics } from "./types/types";

export default class MetricsEngine {
  public computeMonthlyMetrics = (txns: Transaction[]): MonthlyMetrics[] => {
    const map: Record<string, any> = {};

    txns.forEach(t => {
      if (t.is_internal_transfer) return;

      const month = t.date.slice(0, 7);
      map[month] ??= { income: 0, expenses: 0 };

      t.direction === "inflow"
        ? (map[month].income += t.amount)
        : (map[month].expenses += t.amount);
    });

    return Object.entries(map).map(([month, v]) => {
      const savings = v.income - v.expenses;
      return {
        month,
        income: v.income,
        expenses: v.expenses,
        savings,
        savingsRate: v.income ? savings / v.income : 0,
        burnRate: v.expenses
      };
    });
  };

  public computeStdDev = (values: number[]): number => {
    if (!values.length) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(
      values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
    );
  };
}
