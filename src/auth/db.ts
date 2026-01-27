import db from "../config/postgres";
import {
  ICreateUserReqObj,
  ICreateUserTokensReqObj,
  IFetchUserDetailsWithTokensResObj,
  IUsers,
  IUserTokens,
} from "./types/types";

export default class AuthDB {
  protected fetchUserByEmailDb = async (email: string): Promise<IUsers> => {
    const query = `SELECT * FROM users WHERE email = $1`;

    const { rows } = await db.query(query, [email]);
    return rows[0] as unknown as IUsers;
  };

  protected fetchUserByIdDb = async (id: number): Promise<IUsers> => {
    const query = `SELECT * FROM users WHERE id = $1`;

    const { rows } = await db.query(query, [id]);
    return rows[0] as unknown as IUsers;
  };

  protected insertUserDb = async (obj: ICreateUserReqObj) => {
    const query = db.format(`INSERT INTO users ? RETURNING *`, [obj]);

    const { rows } = await db.query(query);
    return rows[0] as unknown as IUsers;
  };

  protected insertUserTokensDb = async (obj: ICreateUserTokensReqObj) => {
    const query = db.format(`INSERT INTO user_tokens ? RETURNING *`, [obj]);

    const { rows } = await db.query(query);
    return rows[0] as unknown as IUserTokens;
  };

  protected updateUserByIdDb = async (obj: Partial<IUsers>) => {
    const { id, ...rest } = obj;

    const query = db.format(`UPDATE users SET ? WHERE id = $1`, rest as any);

    await db.query(query, [id]);
  };

  protected updateUserByUUIDDb = async (obj: Partial<IUsers>) => {
    const { uuid, ...rest } = obj;

    const query = db.format(`UPDATE users SET ? WHERE uuid = $1`, [
      rest as any,
    ]);

    await db.query(query, [uuid]);
  };

  protected fetchUserDetailsWithTokensByIdDb = async (
    id: number,
  ): Promise<IFetchUserDetailsWithTokensResObj> => {
    const query = `
      SELECT 
        u.*, json_build_object(
          'id', ut.id,
          'user_id', ut.user_id,
          'free_tokens_granted', ut.free_tokens_granted,
          'free_tokens_used', ut.free_tokens_used,
          'paid_tokens_granted', ut.paid_tokens_granted,
          'paid_tokens_used', ut.paid_tokens_used,
          'total_tokens_used', ut.total_tokens_used,
          'total_tokens_granted', ut.total_tokens_granted,
          'total_net_tokens', ut.total_net_tokens
          ) AS user_tokens
      FROM 
        users u
      JOIN 
        user_tokens ut ON u.id = ut.user_id
      WHERE 
        u.id = $1
      LIMIT 1;
    `;

    const { rows } = await db.query(query, [id]);
    return rows[0] as unknown as IFetchUserDetailsWithTokensResObj;
  };

  protected fetchUserDetailsWithTokensByEmailDb = async (
    email: string,
  ): Promise<IFetchUserDetailsWithTokensResObj> => {
    const query = `
      SELECT 
        u.*, json_build_object(
          'id', ut.id,
          'user_id', ut.user_id,
          'free_tokens_granted', ut.free_tokens_granted,
          'free_tokens_used', ut.free_tokens_used,
          'paid_tokens_granted', ut.paid_tokens_granted,
          'paid_tokens_used', ut.paid_tokens_used,
          'total_tokens_used', ut.total_tokens_used,
          'total_tokens_granted', ut.total_tokens_granted,
          'total_net_tokens', ut.total_net_tokens
          ) AS user_tokens
      FROM 
        users u
      JOIN 
        user_tokens ut ON u.id = ut.user_id
      WHERE 
        u.email = $1
      LIMIT 1;
    `;

    const { rows } = await db.query(query, [email]);
    return rows[0] as unknown as IFetchUserDetailsWithTokensResObj;
  };
}
