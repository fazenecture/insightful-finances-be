import db from "../config/postgres";
import {
  IFetchPaymentByUUIDReqObj,
  IInsertPaymentDbReqObj,
  IPaymentDbResObj,
  IUpdateUserTokensDbReqObj,
} from "./types/types";

export default class PaymentsDb {
  protected insertPaymentsDb = async (obj: IInsertPaymentDbReqObj) => {
    const query = db.format(`INSERT INTO payments ? RETURNING *`, obj as any);

    const { rows } = await db.query(query);
    return rows[0] as unknown as any;
  };

  protected fetchPaymentsByUUID = async (obj: IFetchPaymentByUUIDReqObj) => {

    const client = obj?.dbClient || db;
    
    const { uuid } = obj;

    const query = `SELECT * FROM payments WHERE uuid = $1 LIMIT 1`;
    const values = [uuid];

    const { rows } = await client.query(query, values);
    return rows[0] as unknown as IPaymentDbResObj;
  };

  protected updatePaymentById = async (obj: Partial<IPaymentDbResObj>) => {
    const { uuid, ...rest } = obj;

    const client = obj?.dbClient || db as any;

    delete rest.dbClient;

    const query = client.format(
      `UPDATE payments SET ? WHERE uuid = $1 RETURNING *`,
      rest as any,
    );
    const values = [uuid];

    const { rows } = await db.query(query, values);
    return rows[0] as unknown as IPaymentDbResObj;
  };

  public updateUserTokensDb = async (obj: IUpdateUserTokensDbReqObj) => {
    const { user_id, ...rest } = obj;

    const query = db.format(
      `UPDATE user_tokens SET ? WHERE user_id = $1`,
      rest as any,
    );

    await db.query(query, [user_id]);
  };

  public incrementUserTokensDb = async (obj: Partial<IUpdateUserTokensDbReqObj>) => {
    
    const { user_id, paid_tokens_granted } = obj;

    const query = `
      UPDATE user_tokens 
      SET paid_tokens_granted = paid_tokens_granted + $1,
          updated_at = NOW()
      WHERE user_id = $2
    `;

    const client = obj?.dbClient || db;

    await client.query(query, [paid_tokens_granted, user_id]);
  }
}
