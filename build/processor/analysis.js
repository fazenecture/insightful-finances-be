"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class FinancialAnalysisEngine {
    constructor() {
        /* ================================
           CORE FINANCIAL METRICS
           ================================ */
        this.computeCoreMetrics = (input) => {
            const txns = input.transactions.filter((t) => !t.is_internal_transfer);
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
        this.computeCashFlowAnalysis = (input) => {
            const map = {};
            input.transactions.forEach((t) => {
                var _a;
                if (t.is_internal_transfer)
                    return;
                const m = this.getYearMonth(t.date);
                (_a = map[m]) !== null && _a !== void 0 ? _a : (map[m] = { inflow: 0, outflow: 0 });
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
        this.computeCategoryAnalysis = (input) => {
            const totals = {};
            input.transactions.forEach((t) => {
                var _a, _b, _c;
                if (t.direction !== "outflow" || t.is_internal_transfer)
                    return;
                totals[(_a = t.category) !== null && _a !== void 0 ? _a : "Uncategorized"] =
                    ((_c = totals[(_b = t.category) !== null && _b !== void 0 ? _b : "Uncategorized"]) !== null && _c !== void 0 ? _c : 0) + Number.parseInt(t.amount.toString());
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
        this.computeCreditCardAnalysis = (input) => {
            const cc = input.transactions.filter((t) => t.source === "credit_card");
            const spend = this.sum(cc, "outflow");
            const payments = this.sum(cc, "inflow");
            return {
                totalCreditSpend: spend,
                creditSpendRatio: spend / (this.sum(input.transactions, "outflow") || 1),
                interestPaid: cc
                    .filter((t) => t.is_interest)
                    .reduce((s, t) => s + Number.parseInt(t.amount.toString()), 0),
                feesPaid: cc.filter((t) => t.is_fee).reduce((s, t) => s + Number.parseInt(t.amount.toString()), 0),
                revolvingDetected: spend > payments * 1.2,
            };
        };
        /* ================================
           INCOME SOURCE ANALYSIS
           ================================ */
        this.computeIncomeSourceAnalysis = (input) => {
            const sources = {};
            input.transactions
                .filter((t) => t.direction === "inflow")
                .forEach((t) => {
                var _a, _b;
                const key = (_a = t.merchant) !== null && _a !== void 0 ? _a : "Unknown";
                sources[key] = ((_b = sources[key]) !== null && _b !== void 0 ? _b : 0) + Number.parseInt(t.amount.toString());
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
           ANOMALY DETECTION
           ================================ */
        this.detectAnomalies = (input) => {
            const expenses = input.transactions.filter((t) => t.direction === "outflow");
            const mean = this.mean(expenses.map((t) => Number.parseInt(t.amount.toString())));
            const std = this.stdDev(expenses.map((t) => Number.parseInt(t.amount.toString())));
            return expenses.filter((t) => Number.parseInt(t.amount.toString()) > mean + 3 * std);
        };
        /* ================================
           HEALTH SCORE
           ================================ */
        this.computeFinancialHealthScore = (input) => {
            let score = 100;
            if (input.core.savingsRate < 0.2)
                score -= 25;
            if (input.credit.revolvingDetected)
                score -= 20;
            if (input.core.avgMonthlyBurn > input.core.totalIncome * 0.7)
                score -= 20;
            if (input.core.incomeConsistency > 0.4)
                score -= 15;
            return Math.max(0, Math.min(100, score));
        };
        /* ================================
           PRIVATE HELPERS
           ================================ */
        this.sum = (txns, dir) => txns.filter((t) => t.direction === dir).reduce((s, t) => s + Number.parseInt(t.amount.toString()), 0);
        this.groupMonthly = (txns, dir) => {
            var _a;
            const map = {};
            for (const t of txns) {
                if (t.direction !== dir)
                    continue;
                const month = this.getYearMonth(t.date);
                map[month] = ((_a = map[month]) !== null && _a !== void 0 ? _a : 0) + Number.parseInt(t.amount.toString());
            }
            return Object.values(map);
        };
        this.countMonths = (txns) => new Set(txns.map(t => this.getYearMonth(t.date))).size || 1;
        this.getYearMonth = (date) => {
            if (date instanceof Date) {
                // Convert to YYYY-MM safely
                return date.toISOString().slice(0, 7);
            }
            if (typeof date === "string") {
                console.log('date: ', date);
                return date.slice(0, 7);
            }
            console.log('date: ', date);
            throw new Error("Invalid date type in transaction");
        };
        this.mean = (vals) => vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        this.stdDev = (vals) => {
            const m = this.mean(vals);
            return Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (vals.length || 1));
        };
    }
}
exports.default = FinancialAnalysisEngine;
//# sourceMappingURL=analysis.js.map