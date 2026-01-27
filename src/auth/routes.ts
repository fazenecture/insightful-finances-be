import { Router } from "express";
import UsersController from "./controller";
import { validateLogin, validateSignUp } from "./middleware";
import { authValidation } from "../middleware/auth.middleware";

const router = Router();
const { signUpController, loginController, fetchMeController } =
  new UsersController();

// POST /api/auth/signup
router.post("/signup", validateSignUp, signUpController);

// POST /api/auth/login
router.post("/login", validateLogin, loginController);

// POST /api/auth/me
router.get("/me", authValidation, fetchMeController);

export default router;
