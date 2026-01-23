// processor/db.ts
import db from "../config/postgres";
import ErrorHandler from "../helper/error.handler";
import {
  IAnalysisSessionObj,
  IDetectedSubscription,
  IFetchNarrativeDbReqObj,
  IFetchTransactionsReqObj,
  IUpdateAnalysisSessionBySessionIdReqObj,
  Transaction,
} from "./types/types";

export default class ProcessorDB {
  /* ================================
     TRANSACTIONS
     ================================ */

  public insertTransactions = async (input: {
    transactions: Transaction[];
  }): Promise<void> => {
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
            t.is_fee ?? false,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new ErrorHandler({
        status_code: 500,
        message: "Failed to insert transactions",
      });
    } finally {
      client.release();
    }
  };

  public insertBulkTransactions = async (input: {
    transactions: Transaction[];
  }): Promise<void> => {
    if (input.transactions.length === 0) {
      return;
    }

    const query = db.format(`INSERT INTO transactions ?`, input.transactions);

    await db.query(query);
  };

  public fetchTransactionsByUser = async (input: {
    userId: string;
  }): Promise<Transaction[]> => {
    const { rows } = await db.query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY date`,
      [input.userId]
    );
    return rows;
  };

  /* ================================
     ANALYTICS STORAGE
     ================================ */

  public saveMonthlyMetrics = async (input: {
    userId: string;
    months: any[];
  }): Promise<void> => {
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
        [input.userId, m.month, m.inflow, m.outflow, m.netCashFlow]
      );
    }
  };

  public saveSubscriptions = async (
    subscriptions: IDetectedSubscription[]
  ): Promise<void> => {
    if (subscriptions.length === 0) {
      return;
    }

    const query = db.format(`INSERT INTO subscriptions ? `, subscriptions);

    await db.query(query);
  };

  public saveHealthScore = async (input: {
    userId: string;
    score: number;
  }): Promise<void> => {
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

  public saveNarrative = async (input: {
    userId: string;
    narrative: string;
    sessionId: string;
  }): Promise<void> => {
    await db.query(
      `
      INSERT INTO financial_narratives (user_id, narrative, session_id)
      VALUES ($1,$2,$3)
      `,
      [input.userId, input.narrative, input.sessionId]
    );
  };

  public fetchNarrativeBySessionId = async (obj: IFetchNarrativeDbReqObj) => {
    const { session_id, user_id } = obj;

    const query = `
      SELECT * FROM
        financial_narratives
      WHERE 
        session_id = $1 AND user_id = $2
      LIMIT 1;
    `;

    const { rows } = await db.query(query, [session_id, user_id]);
    return rows[0] as unknown as any;
  };

  public insertAnalysisSessionDb = async (obj: IAnalysisSessionObj[]) => {
    if (obj.length === 0) {
      return;
    }

    const query = db.format(`INSERT INTO analysis_sessions ? `, obj);
    await db.query(query);
  };

  public fetchAnalysisSessionBySessionIdDb = async (
    session_id: string
  ): Promise<IAnalysisSessionObj | null> => {
    const query = `
      SELECT id, status, session_id FROM
        analysis_sessions
      WHERE 
        session_id = $1
      LIMIT 1;
    `;

    const { rows } = await db.query(query, [session_id]);
    if (rows.length === 0) {
      return null;
    }
    return rows[0] as unknown as IAnalysisSessionObj;
  };

  public updateAnalysisSessionStatusBySessionIdDb = async (
    obj: IUpdateAnalysisSessionBySessionIdReqObj
  ) => {
    const { session_id, ...rest } = obj;

    const query = db.format(
      `UPDATE analysis_sessions SET ? WHERE session_id = $1`,
      rest as any
    );

    await db.query(query, [session_id]);
  };

  public fetchTransactionDb = async (
    obj: IFetchTransactionsReqObj
  ): Promise<Transaction[]> => {
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

    const { rows } = await db.query(query, values);
    return rows as unknown as Transaction[];
  };

  public fetchTotalTransactionsCountDb = async (
    obj: IFetchTransactionsReqObj
  ) => {
    const { session_id } = obj;

    const query = `
      SELECT COUNT(*)
      FROM
        transactions
      WHERE 
        session_id = $1`;

    const { rows } = await db.query(query, [session_id]);
    return rows[0].count as unknown as any;
  };
}
