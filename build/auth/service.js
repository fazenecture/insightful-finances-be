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
const crypto_1 = require("crypto");
const error_handler_1 = __importDefault(require("../helper/error.handler"));
const helper_1 = __importDefault(require("./helper"));
const moment_1 = __importDefault(require("moment"));
class AuthService extends helper_1.default {
    constructor() {
        super(...arguments);
        this.signUpService = (reqObj) => __awaiter(this, void 0, void 0, function* () {
            const { email, password, full_name } = reqObj;
            const existingUser = yield this.fetchUserByEmailDb(email);
            if (existingUser && (existingUser === null || existingUser === void 0 ? void 0 : existingUser.deleted_at) === null) {
                throw new error_handler_1.default({
                    status_code: 409,
                    message: "User with this email already exists",
                });
            }
            if (existingUser && existingUser.deleted_at !== null) {
                throw new error_handler_1.default({
                    status_code: 410,
                    message: "User with this email was deleted. Please contact support to reactivate your account.",
                });
            }
            const password_hash = this.generatePasswordHash(password);
            const userObj = {
                email,
                uuid: (0, crypto_1.randomUUID)(),
                password_hash,
                full_name,
                is_email_verified: false,
                is_active: true,
                last_login_at: (0, moment_1.default)().format(),
                created_at: (0, moment_1.default)().format(),
            };
            const user = yield this.insertUserDb(userObj);
            const userTokensObj = {
                user_id: user.id,
                free_tokens_granted: 15, // Initial free tokens
                free_tokens_used: 0,
                paid_tokens_granted: 0,
                paid_tokens_used: 0,
                created_at: (0, moment_1.default)().format(),
                created_by: user.id,
            };
            const usersData = yield this.insertUserTokensDb(userTokensObj);
            // Generate JWT Tokens
            const tokens = this.createJwtTokens(user);
            return {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                user: usersData,
            };
        });
        this.loginService = (reqObj) => __awaiter(this, void 0, void 0, function* () {
            const { email, password } = reqObj;
            const user = yield this.fetchUserDetailsWithTokensByEmailDb(email);
            if (!user) {
                throw new error_handler_1.default({
                    status_code: 404,
                    message: "User not found",
                });
            }
            if (!user.is_active) {
                throw new error_handler_1.default({
                    status_code: 403,
                    message: "User account is inactive",
                });
            }
            if (user.deleted_at) {
                throw new error_handler_1.default({
                    status_code: 403,
                    message: "User account is deleted",
                });
            }
            const isPasswordValid = yield this.comparePassword({
                plain_text: password,
                hash_text: user.password_hash,
            });
            if (!isPasswordValid) {
                throw new error_handler_1.default({
                    status_code: 401,
                    message: "Invalid credentials",
                });
            }
            // Generate JWT Tokens
            const tokens = this.createJwtTokens(user);
            // update the last login time
            yield this.updateUserByIdDb({
                id: user.id,
                last_login_at: (0, moment_1.default)().format(),
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
        });
        this.fetchMeService = (user_id) => __awaiter(this, void 0, void 0, function* () {
            const user = yield this.fetchUserDetailsWithTokensByIdDb(user_id);
            if (!user) {
                throw new error_handler_1.default({
                    status_code: 404,
                    message: "User not found",
                });
            }
            if (user.deleted_at) {
                throw new error_handler_1.default({
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
        });
    }
}
exports.default = AuthService;
//# sourceMappingURL=service.js.map