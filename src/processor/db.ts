// processor/db.ts
import db from "../config/postgres";
import ErrorHandler from "../helper/error.handler";
import { IDetectedSubscription, Transaction } from "./types/types";

export default class ProcessorDB {

  /* ================================
     TRANSACTIONS
     ================================ */

  public insertTransactions = async (
    input: { transactions: Transaction[] }
  ): Promise<void> => {
    const client = await db.getClient();

    try {
      await client.query("BEGIN");

      for (const t of input.transactions) {
        await client.query(
          `
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
          `,
          [
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
            t.category ?? null,
            t.subcategory ?? null,
            t.is_internal_transfer ?? false,
            t.is_interest ?? false,
            t.is_fee ?? false
          ]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new ErrorHandler({
        status_code: 500,
        message: "Failed to insert transactions",
      })
    } finally {
      client.release();
    }
  };

  public insertBulkTransactions = async (
    input: { transactions: Transaction[] }
  ): Promise<void> => {

    const query = db.format(
      `INSERT INTO transactions ?`, input.transactions
    );

    await db.query(query);
  }

  public fetchTransactionsByUser = async (
    input: { userId: string }
  ): Promise<Transaction[]> => {
    const { rows } = await db.query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY date`,
      [input.userId]
    );
    return rows;
  };

  /* ================================
     ANALYTICS STORAGE
     ================================ */

  public saveMonthlyMetrics = async (
    input: { userId: string; months: any[] }
  ): Promise<void> => {
    for (const m of input.months) {
      await db.query(
        `
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
        `,
        [
          input.userId,
          m.month,
          m.inflow,
          m.outflow,
          m.netCashFlow
        ]
      );
    }
  };

  public saveSubscriptions = async (
    subscriptions: IDetectedSubscription[]
  ): Promise<void> => {
    const query = db.format(
      `INSERT INTO subscriptions ? ON CONFLICT (id) DO NOTHING`,
      subscriptions
    );

    await db.query(query);
  }

  public saveHealthScore = async (
    input: { userId: string; score: number }
  ): Promise<void> => {
    await db.query(
      `
      INSERT INTO financial_health_scores (user_id, score)
      VALUES ($1,$2)
      ON CONFLICT (user_id)
      DO UPDATE SET score = EXCLUDED.score
      `,
      [input.userId, input.score]
    );
  };

  public saveNarrative = async (
    input: { userId: string; narrative: string }
  ): Promise<void> => {
    await db.query(
      `
      INSERT INTO financial_narratives (user_id, narrative)
      VALUES ($1,$2)
      `,
      [input.userId, input.narrative]
    );
  };
}
