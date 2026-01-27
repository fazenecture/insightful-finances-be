import customErrorHandler from "../helper/custom.error";
import AuthService from "./service";
import { Request, Response } from "express";

export default class AuthController extends AuthService {
  public signUpController = async (req: Request, res: Response) => {
    try {
      const { full_name, email, password } = req.body;

      const result = await this.signUpService({
        full_name,
        email,
        password,
      });

      res.status(201).send({
        success: true,
        message: "User registered successfully",
        data: result,
      });
    } catch (error) {
      // Handle error appropriately
      customErrorHandler(res, error);
    }
  };

  public loginController = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const result = await this.loginService({
        email,
        password,
      });

      res.status(200).send({
        success: true,
        message: "User logged in successfully",
        data: result,
      });
    } catch (error) {
      // Handle error appropriately
      customErrorHandler(res, error);
    }
  };

  public fetchMeController = async (req: Request, res: Response) => {
    try {
      const { user_id } = req.body;

      const result = await this.fetchMeService(user_id);

      res.status(200).send({
        success: true,
        message: "User fetched successfully",
        data: result,
      });
    } catch (error) {
      // Handle error appropriately
      customErrorHandler(res, error);
    }
  }
}
