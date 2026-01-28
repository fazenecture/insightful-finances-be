import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AuthService from "../auth/service";
import { TokenType } from "../auth/types/enums";

const { PUBLIC_KEY, reGenerateTokens } = new AuthService();

export const authValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1] || req.query?.token || "";

    if (!token?.length) {
      res.status(401).send({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const decoded = jwt.verify(token, PUBLIC_KEY, {
        algorithms: ["RS256"],
    }) as any;
    if (decoded?.token_type === TokenType.ACCESS_TOKEN) {
      Object.assign(req.body, {
        user_id: decoded?.id,
        user_uuid: decoded?.uuid,
        is_active: decoded?.is_active,
      });
      next();
    } else if (decoded?.token_type === TokenType.REFRESH_TOKEN) {
      const newTokens = await reGenerateTokens(decoded);
      res.setHeader("x-new-access-token", newTokens.access_token);
      res.setHeader("x-new-refresh-token", newTokens.refresh_token);
      Object.assign(req.body, {
        user_id: newTokens.user.id,
        user_uuid: newTokens.user.uuid,
        is_active: newTokens.user.is_active,
      });
      next();
    } else {
      res.status(401).send({
        success: false,
        message: "Unauthorized",
      });
      return;
    }
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Token expired",
      });
    } else {
      res.status(400).send({
        success: false,
        message: "Validation failed",
        errors: error,
      });
    }
  }
};