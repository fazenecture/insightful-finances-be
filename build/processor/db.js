"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// processor/db.ts
const postgres_1 = __importDefault(require("../config/postgres"));
const error_handler_1 = __importDefault(require("../helper/error.handler"));
class ProcessorDB {
    constructor() {
        /* ================================
           TRANSACTIONS
           ================================ */
        this.insertTransactions = (input) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const client = yield postgres_1.default.getClient();
            try {
                yield client.query("BEGIN");
                for (const t of input.transactions) {
                    yield client.query(`
          INSERT INTO transactions (
            transaction_id,
            user_id,
            account_id,
            date,
            description,
            merchant,
            amount,
            direction,
            source,
            currency,
            category,
            subcategory,
            is_internal_transfer,
            is_interest,
            is_fee
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT (transaction_id) DO NOTHING
          `, [
                        t.transaction_id,
                        t.user_id,
                        t.account_id,
                        t.date,
                        t.description,
                        t.merchant,
                        t.amount,
                        t.direction,
                        t.source,
                        t.currency,
                        (_a = t.category) !== null && _a !== void 0 ? _a : null,
                        (_b = t.subcategory) !== null && _b !== void 0 ? _b : null,
                        (_c = t.is_internal_transfer) !== null && _c !== void 0 ? _c : false,
                        (_d = t.is_interest) !== null && _d !== void 0 ? _d : false,
                        (_e = t.is_fee) !== null && _e !== void 0 ? _e : false,
                    ]);
                }
                yield client.query("COMMIT");
            }
            catch (err) {
                yield client.query("ROLLBACK");
                throw new error_handler_1.default({
                    status_code: 500,
                    message: "Failed to insert transactions",
                });
            }
            finally {
                client.release();
            }
        });
        this.insertBulkTransactions = (input) => __awaiter(this, void 0, void 0, function* () {
            if (input.transactions.length === 0) {
                return;
            }
            const query = postgres_1.default.format(`INSERT INTO transactions ?`, input.transactions);
            yield postgres_1.default.query(query);
        });
        this.fetchTransactionsByUser = (input) => __awaiter(this, void 0, void 0, function* () {
            const { rows } = yield postgres_1.default.query(`SELECT * FROM transactions WHERE user_id = $1 ORDER BY date`, [input.userId]);
            return rows;
        });
        /* ================================
           ANALYTICS STORAGE
           ================================ */
        this.saveMonthlyMetrics = (input) => __awaiter(this, void 0, void 0, function* () {
            for (const m of input.months) {
                yield postgres_1.default.query(`
        INSERT INTO monthly_metrics (
          user_id,
          month,
          income,
          expenses,
          net_cashflow
        )
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (user_id, month)
        DO UPDATE SET
          income = EXCLUDED.income,
          expenses = EXCLUDED.expenses,
          net_cashflow = EXCLUDED.net_cashflow
        `, [input.userId, m.month, m.inflow, m.outflow, m.netCashFlow]);
            }
        });
        this.saveSubscriptions = (subscriptions) => __awaiter(this, void 0, void 0, function* () {
            if (subscriptions.length === 0) {
                return;
            }
            const query = postgres_1.default.format(`INSERT INTO subscriptions ? `, subscriptions);
            yield postgres_1.default.query(query);
        });
        this.saveHealthScore = (input) => __awaiter(this, void 0, void 0, function* () {
            yield postgres_1.default.query(`
      INSERT INTO financial_health_scores (user_id, score)
      VALUES ($1,$2)
      ON CONFLICT (user_id)
      DO UPDATE SET score = EXCLUDED.score
      `, [input.userId, input.score]);
        });
        this.saveNarrative = (input) => __awaiter(this, void 0, void 0, function* () {
            yield postgres_1.default.query(`
      INSERT INTO financial_narratives (user_id, narrative, session_id)
      VALUES ($1,$2,$3)
      `, [input.userId, input.narrative, input.sessionId]);
        });
        this.fetchNarrativeBySessionId = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { session_id, user_id } = obj;
            const query = `
      SELECT * FROM
        financial_narratives
      WHERE 
        session_id = $1 AND user_id = $2
      LIMIT 1;
    `;
            const { rows } = yield postgres_1.default.query(query, [session_id, user_id]);
            return rows[0];
        });
        this.insertAnalysisSessionDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            if (obj.length === 0)
                return [];
            const query = postgres_1.default.format(`
    INSERT INTO analysis_sessions ?
    ON CONFLICT (session_id)
    DO UPDATE SET
      session_id = analysis_sessions.session_id -- no-op update
    RETURNING
      session_id,
      status,
      (xmax = 0) AS is_new
    `, obj);
            const { rows } = yield postgres_1.default.query(query);
            return rows;
        });
        this.updateAnalysisSessionStatusBySessionIdDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { session_id } = obj, rest = __rest(obj, ["session_id"]);
            const query = postgres_1.default.format(`UPDATE analysis_sessions SET ? WHERE session_id = $1`, rest);
            yield postgres_1.default.query(query, [session_id]);
        });
        this.fetchTransactionDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { page, limit, session_id } = obj;
            const offset = page * limit;
            const query = `
      SELECT *
      FROM
        transactions
      WHERE 
        session_id = $1
      LIMIT $2
      OFFSET $3`;
            const values = [session_id, limit, offset];
            const { rows } = yield postgres_1.default.query(query, values);
            return rows;
        });
        this.fetchTotalTransactionsCountDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { session_id } = obj;
            const query = `
      SELECT COUNT(*)
      FROM
        transactions
      WHERE 
        session_id = $1`;
            const { rows } = yield postgres_1.default.query(query, [session_id]);
            return rows[0].count;
        });
    }
}
exports.default = ProcessorDB;
//# sourceMappingURL=db.js.map