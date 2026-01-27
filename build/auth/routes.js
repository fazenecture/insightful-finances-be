"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = __importDefault(require("./controller"));
const middleware_1 = require("./middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const { signUpController, loginController, fetchMeController } = new controller_1.default();
// POST /api/auth/signup
router.post("/signup", middleware_1.validateSignUp, signUpController);
// POST /api/auth/login
router.post("/login", middleware_1.validateLogin, loginController);
// POST /api/auth/me
router.get("/me", auth_middleware_1.authValidation, fetchMeController);
exports.default = router;
//# sourceMappingURL=routes.js.map