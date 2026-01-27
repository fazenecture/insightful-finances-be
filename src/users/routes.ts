import { Router } from "express";
import UsersController from "./controller";

const router = Router();
const {
  // Define controller methods here
} = new UsersController();

// Define user-related routes here

export default router;