// processor/analysis.ts
import { Transaction } from "./types/types";

export default class FinancialAnalysisEngine {
  /* ================================
     CORE FINANCIAL METRICS
     ================================ */

  public computeCoreMetrics = (input: { transactions: Transaction[] }) => {
    const txns = input.transactions.filter(
      (t) =>
        !t.is_internal_transfer && !t.subcategory?.includes("self_transfer"),
    );

    const income = this.sum(txns, "inflow");
    const expenses = this.sum(txns, "outflow");

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netSavings: income - expenses,
      savingsRate: income ? (income - expenses) / income : 0,
      avgMonthlyBurn: expenses / this.countMonths(txns),
      incomeConsistency: this.stdDev(this.groupMonthly(txns, "inflow")),
      expenseVolatility: this.stdDev(this.groupMonthly(txns, "outflow")),
    };
  };

  /* ================================
     CASH FLOW ANALYSIS
     ================================ */

  public computeCashFlowAnalysis = (input: { transactions: Transaction[] }) => {
    const map: Record<string, { inflow: number; outflow: number }> = {};

    input.transactions.forEach((t) => {
      if (t.is_internal_transfer) return;
      const m = this.getYearMonth(t.date);
      map[m] ??= { inflow: 0, outflow: 0 };
      t.direction === "inflow"
        ? (map[m].inflow += Number.parseInt(t.amount.toString()))
        : (map[m].outflow += Number.parseInt(t.amount.toString()));
    });

    const months = Object.entries(map).map(([month, v]) => ({
      month,
      inflow: v.inflow,
      outflow: v.outflow,
      netCashFlow: v.inflow - v.outflow,
    }));

    return {
      months,
      positiveMonths: months.filter((m) => m.netCashFlow > 0).length,
      negativeMonths: months.filter((m) => m.netCashFlow < 0).length,
      cashflowStabilityIndex: this.stdDev(months.map((m) => m.netCashFlow)),
      cashflowGaps: months.filter((m) => m.netCashFlow < 0),
    };
  };

  /* ================================
     CATEGORY ANALYSIS
     ================================ */

  public computeCategoryAnalysis = (input: { transactions: Transaction[] }) => {
    const totals: Record<string, number> = {};

    input.transactions.forEach((t) => {
      if (t.direction !== "outflow" || t.is_internal_transfer) return;
      totals[t.category ?? "Uncategorized"] =
        (totals[t.category ?? "Uncategorized"] ?? 0) +
        Number.parseInt(t.amount.toString());
    });

    const totalExpense = Object.values(totals).reduce((a, b) => a + b, 0);

    return Object.entries(totals).map(([category, amount]) => ({
      category,
      amount,
      percentageOfExpense: totalExpense ? amount / totalExpense : 0,
    }));
  };

  /* ================================
     CREDIT CARD ANALYSIS
     ================================ */

  public computeCreditCardAnalysis = (input: {
    transactions: Transaction[];
  }) => {
    const cc = input.transactions.filter((t) => t.source === "credit_card");

    const spend = this.sum(cc, "outflow");
    const payments = this.sum(cc, "inflow");

    return {
      totalCreditSpend: spend,
      creditSpendRatio: spend / (this.sum(input.transactions, "outflow") || 1),
      interestPaid: cc
        .filter((t) => t.is_interest)
        .reduce((s, t) => s + Number.parseInt(t.amount.toString()), 0),
      feesPaid: cc
        .filter((t) => t.is_fee)
        .reduce((s, t) => s + Number.parseInt(t.amount.toString()), 0),
      revolvingDetected: spend > payments * 1.2,
    };
  };

  /* ================================
     INCOME SOURCE ANALYSIS
     ================================ */

  public computeIncomeSourceAnalysis = (input: {
    transactions: Transaction[];
  }) => {
    const sources: Record<string, number> = {};

    input.transactions
      .filter((t) => t.direction === "inflow")
      .forEach((t) => {
        const key = t.merchant ?? "Unknown";
        sources[key] =
          (sources[key] ?? 0) + Number.parseInt(t.amount.toString());
      });

    const values = Object.values(sources);
    const total = values.reduce((a, b) => a + b, 0);

    return {
      sources,
      dependenceOnSingleSource: Math.max(...values) / (total || 1),
      incomeConsistency: this.stdDev(values),
    };
  };

  /* ================================
     EXPEND SOURCE ANALYSIS
     ================================ */

  public computeExpendSourceAnalysis = (input: {
    transactions: Transaction[];
  }) => {
    const sources: Record<string, number> = {};

    input.transactions
      .filter((t) => t.direction === "outflow")
      .forEach((t) => {
        const key = t.merchant ?? "Unknown";
        sources[key] =
          (sources[key] ?? 0) + Number.parseInt(t.amount.toString());
      });

    const values = Object.values(sources);
    const total = values.reduce((a, b) => a + b, 0);

    return {
      sources,
      dependenceOnSingleSource: Math.max(...values) / (total || 1),
      expenseVolatility: this.stdDev(values),
    };
  };

  /* ================================
     ANOMALY DETECTION
     ================================ */

  public detectAnomalies = (input: { transactions: Transaction[] }) => {
    const expenses = input.transactions.filter(
      (t) => t.direction === "outflow",
    );
    const mean = this.mean(
      expenses.map((t) => Number.parseInt(t.amount.toString())),
    );
    const std = this.stdDev(
      expenses.map((t) => Number.parseInt(t.amount.toString())),
    );

    return expenses.filter(
      (t) => Number.parseInt(t.amount.toString()) > mean + 3 * std,
    );
  };

  /* ================================
     HEALTH SCORE
     ================================ */

  public computeFinancialHealthScore = (input: {
    core: any;
    credit: any;
  }): number => {
    let score = 100;

    if (input.core.savingsRate < 0.2) score -= 25;
    if (input.credit.revolvingDetected) score -= 20;
    if (input.core.avgMonthlyBurn > input.core.totalIncome * 0.7) score -= 20;
    if (input.core.incomeConsistency > 0.4) score -= 15;

    return Math.max(0, Math.min(100, score));
  };

  /* ================================
     PRIVATE HELPERS
     ================================ */

  private readonly sum = (
    txns: Transaction[],
    dir: "inflow" | "outflow",
  ): number => {
    return txns
      .filter((t) => t.direction === dir)
      .reduce((total, t) => {
        const amount = Number(t.amount); // 👈 FIX (no parseInt)
        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0);
  };

  private readonly groupMonthly = (
    txns: Transaction[],
    dir: "inflow" | "outflow",
  ): number[] => {
    const map: Record<string, number> = {};

    for (const t of txns) {
      if (t.direction !== dir) continue;

      const month = this.getYearMonth(t.date);
      map[month] = (map[month] ?? 0) + Number.parseInt(t.amount.toString());
    }

    return Object.values(map);
  };

  private readonly countMonths = (txns: Transaction[]) =>
    new Set(txns.map((t) => this.getYearMonth(t.date))).size || 1;

  private readonly getYearMonth = (date: string | Date): string => {
    if (date instanceof Date) {
      // Convert to YYYY-MM safely
      return date.toISOString().slice(0, 7);
    }

    if (typeof date === "string") {
      console.log("date: ", date);
      return date.slice(0, 7);
    }

    console.log("date: ", date);
    throw new Error("Invalid date type in transaction");
  };

  private readonly mean = (vals: number[]) =>
    vals.reduce((a, b) => a + b, 0) / (vals.length || 1);

  private readonly stdDev = (vals: number[]) => {
    const m = this.mean(vals);
    return Math.sqrt(
      vals.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (vals.length || 1),
    );
  };
}
