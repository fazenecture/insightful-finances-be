import AuthDB from "./db";
import { TokenType } from "./types/enums";
import fs from "fs";
import jwt from "jsonwebtoken";
import { IComparePasswordObj, IToken, IUsers } from "./types/types";
import ErrorHandler from "../helper/error.handler";
import bcrypt from "bcrypt";

export default class AuthHelper extends AuthDB {
  private _PRIVATE_KEY = fs.readFileSync("jwtRS256.key");
  public PUBLIC_KEY = fs.readFileSync("jwtRS256.key.pub");

  protected createJwtTokens = (user: IUsers) => {
    try {
      const userData = {
        id: user.id,
        uuid: user.uuid,
        phone: user.phone,
        email: user?.email || "",
        token_type: TokenType.ACCESS_TOKEN,
      };
      const accessToken = jwt.sign(userData, this._PRIVATE_KEY, {
        algorithm: "RS256",
        expiresIn: "7d",
      });

      const setRefresh = {
        token_type: TokenType.REFRESH_TOKEN,
        id: user.id,
        phone_number: user.phone,
        email: user.email,
      };

      const refreshToken = jwt.sign(setRefresh, this._PRIVATE_KEY, {
        algorithm: "RS256",
        expiresIn: "30d",
      });

      const token: IToken = {
        access_token: accessToken,
        refresh_token: refreshToken,
      };

      return token;
    } catch (error) {
      throw new ErrorHandler({
        status_code: 400,
        message: "Failed to generate tokens",
      });
    }
  };

  public reGenerateTokens = async (decoded_data: any) => {
    const user = await this.fetchUserByIdDb(decoded_data.id);

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

    const userData = {
      id: user.id,
      uuid: user.uuid,
      password_hash: user.password_hash,
      phone: user.phone,
      email: user?.email || "",
      token_type: TokenType.ACCESS_TOKEN,
    };

    const accessToken = jwt.sign(userData, this._PRIVATE_KEY, {
      algorithm: "RS256",
      expiresIn: "7d",
    });

    const refreshData = {
      token_type: TokenType.REFRESH_TOKEN,
      id: decoded_data.id,
      uuid: decoded_data.uuid,
      email: decoded_data.email,
    };
    const refreshToken = jwt.sign(refreshData, this._PRIVATE_KEY, {
      algorithm: "RS256",
      expiresIn: "30d",
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  };

  protected generatePasswordHash = (password: string): string => {
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(password, salt);
    return hash;
  };

  protected comparePassword = async (
    obj: IComparePasswordObj,
  ): Promise<boolean> => {
    const { plain_text, hash_text } = obj;
    return bcrypt.compare(plain_text, hash_text);
  };
}
