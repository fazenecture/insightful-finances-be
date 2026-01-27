"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const custom_error_1 = __importDefault(require("../helper/custom.error"));
const service_1 = __importDefault(require("./service"));
class AuthController extends service_1.default {
    constructor() {
        super(...arguments);
        this.signUpController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { full_name, email, password } = req.body;
                const result = yield this.signUpService({
                    full_name,
                    email,
                    password,
                });
                res.status(201).send({
                    success: true,
                    message: "User registered successfully",
                    data: result,
                });
            }
            catch (error) {
                // Handle error appropriately
                (0, custom_error_1.default)(res, error);
            }
        });
        this.loginController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password } = req.body;
                const result = yield this.loginService({
                    email,
                    password,
                });
                res.status(200).send({
                    success: true,
                    message: "User logged in successfully",
                    data: result,
                });
            }
            catch (error) {
                // Handle error appropriately
                (0, custom_error_1.default)(res, error);
            }
        });
        this.fetchMeController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { user_id } = req.body;
                const result = yield this.fetchMeService(user_id);
                res.status(200).send({
                    success: true,
                    message: "User fetched successfully",
                    data: result,
                });
            }
            catch (error) {
                // Handle error appropriately
                (0, custom_error_1.default)(res, error);
            }
        });
    }
}
exports.default = AuthController;
//# sourceMappingURL=controller.js.map