import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const validateSignUp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bodySchema = Joi.object({
      full_name: Joi.string().min(3).max(100).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).max(128).required(),
    });

    req.body = await bodySchema.validateAsync(req.body);
    next();
  } catch (error: any) {
    res.status(400).send({
      success: false,
      message: "Validation failed",
      errors: error.details.map((detail) => detail.message),
    });
  }
};

export const validateLogin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bodySchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).max(128).required(),
    });

    req.body = await bodySchema.validateAsync(req.body);
    next();
  } catch (error: any) {
    res.status(400).send({
      success: false,
      message: "Validation failed",
      errors: error.details.map((detail) => detail.message),
    });
  }
};
