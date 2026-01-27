import { randomUUID } from "crypto";
import ErrorHandler from "../helper/error.handler";
import AuthHelper from "./helper";
import {
  ICreateUserReqObj,
  ICreateUserTokensReqObj,
  ILoginReqObj,
  ISignupReqObj,
} from "./types/types";
import moment from "moment";

export default class AuthService extends AuthHelper {
  protected signUpService = async (reqObj: ISignupReqObj) => {
    const { email, password, full_name } = reqObj;

    const existingUser = await this.fetchUserByEmailDb(email);

    if (existingUser && existingUser?.deleted_at === null) {
      throw new ErrorHandler({
        status_code: 409,
        message: "User with this email already exists",
      });
    }

    if (existingUser && existingUser.deleted_at !== null) {
      throw new ErrorHandler({
        status_code: 410,
        message:
          "User with this email was deleted. Please contact support to reactivate your account.",
      });
    }

    const password_hash = this.generatePasswordHash(password);

    const userObj: ICreateUserReqObj = {
      email,
      uuid: randomUUID(),
      password_hash,
      full_name,
      is_email_verified: false,
      is_active: true,
      last_login_at: moment().format(),
      created_at: moment().format(),
    };

    const user = await this.insertUserDb(userObj);

    const userTokensObj: ICreateUserTokensReqObj = {
      user_id: user.id,
      free_tokens_granted: 15, // Initial free tokens
      free_tokens_used: 0,

      paid_tokens_granted: 0,
      paid_tokens_used: 0,

      created_at: moment().format(),
      created_by: user.id,
    };

    const usersData = await this.insertUserTokensDb(userTokensObj);

    // Generate JWT Tokens
    const tokens = this.createJwtTokens(user);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: usersData,
    };
  };

  protected loginService = async (reqObj: ILoginReqObj) => {
    const { email, password } = reqObj;

    const user = await this.fetchUserDetailsWithTokensByEmailDb(email);

    if (!user) {
      throw new ErrorHandler({
        status_code: 404,
        message: "User not found",
      });
    }

    if (!user.is_active) {
      throw new ErrorHandler({
        status_code: 403,
        message: "User account is inactive",
      });
    }

    if (user.deleted_at) {
      throw new ErrorHandler({
        status_code: 403,
        message: "User account is deleted",
      });
    }

    const isPasswordValid = await this.comparePassword({
      plain_text: password,
      hash_text: user.password_hash,
    });

    if (!isPasswordValid) {
      throw new ErrorHandler({
        status_code: 401,
        message: "Invalid credentials",
      });
    }

    // Generate JWT Tokens
    const tokens = this.createJwtTokens(user);

    // update the last login time
    await this.updateUserByIdDb({
      id: user.id,
      last_login_at: moment().format(),
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: {
        uuid: user.uuid,
        email: user.email,
        full_name: user.full_name,
        is_email_verified: user.is_email_verified,
        is_active: user.is_active,
        user_tokens: user.user_tokens,
      }
    };
  };

  protected fetchMeService = async (user_id: number) => {
    const user = await this.fetchUserDetailsWithTokensByIdDb(user_id);

    if (!user) {
      throw new ErrorHandler({
        status_code: 404,
        message: "User not found",
      });
    }

    if (user.deleted_at) {
      throw new ErrorHandler({
        status_code: 403,
        message: "User account is deleted",
      });
    }

    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      full_name: user.full_name,
      is_email_verified: user.is_email_verified,
      is_active: user.is_active,
      user_tokens: user.user_tokens,
    };
  }
}
