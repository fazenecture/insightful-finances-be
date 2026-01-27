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
const db_1 = __importDefault(require("./db"));
const enums_1 = require("./types/enums");
const fs_1 = __importDefault(require("fs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const error_handler_1 = __importDefault(require("../helper/error.handler"));
const bcrypt_1 = __importDefault(require("bcrypt"));
class AuthHelper extends db_1.default {
    constructor() {
        super(...arguments);
        this._PRIVATE_KEY = fs_1.default.readFileSync("jwtRS256.key");
        this.PUBLIC_KEY = fs_1.default.readFileSync("jwtRS256.key.pub");
        this.createJwtTokens = (user) => {
            try {
                const userData = {
                    id: user.id,
                    uuid: user.uuid,
                    phone: user.phone,
                    email: (user === null || user === void 0 ? void 0 : user.email) || "",
                    token_type: enums_1.TokenType.ACCESS_TOKEN,
                };
                const accessToken = jsonwebtoken_1.default.sign(userData, this._PRIVATE_KEY, {
                    algorithm: "RS256",
                    expiresIn: "7d",
                });
                const setRefresh = {
                    token_type: enums_1.TokenType.REFRESH_TOKEN,
                    id: user.id,
                    phone_number: user.phone,
                    email: user.email,
                };
                const refreshToken = jsonwebtoken_1.default.sign(setRefresh, this._PRIVATE_KEY, {
                    algorithm: "RS256",
                    expiresIn: "30d",
                });
                const token = {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                };
                return token;
            }
            catch (error) {
                throw new error_handler_1.default({
                    status_code: 400,
                    message: "Failed to generate tokens",
                });
            }
        };
        this.reGenerateTokens = (decoded_data) => __awaiter(this, void 0, void 0, function* () {
            const user = yield this.fetchUserByIdDb(decoded_data.id);
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
            const userData = {
                id: user.id,
                uuid: user.uuid,
                password_hash: user.password_hash,
                phone: user.phone,
                email: (user === null || user === void 0 ? void 0 : user.email) || "",
                token_type: enums_1.TokenType.ACCESS_TOKEN,
            };
            const accessToken = jsonwebtoken_1.default.sign(userData, this._PRIVATE_KEY, {
                algorithm: "RS256",
                expiresIn: "7d",
            });
            const refreshData = {
                token_type: enums_1.TokenType.REFRESH_TOKEN,
                id: decoded_data.id,
                uuid: decoded_data.uuid,
                email: decoded_data.email,
            };
            const refreshToken = jsonwebtoken_1.default.sign(refreshData, this._PRIVATE_KEY, {
                algorithm: "RS256",
                expiresIn: "30d",
            });
            return {
                access_token: accessToken,
                refresh_token: refreshToken,
                user,
            };
        });
        this.generatePasswordHash = (password) => {
            const salt = bcrypt_1.default.genSaltSync(12);
            const hash = bcrypt_1.default.hashSync(password, salt);
            return hash;
        };
        this.comparePassword = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { plain_text, hash_text } = obj;
            return bcrypt_1.default.compare(plain_text, hash_text);
        });
    }
}
exports.default = AuthHelper;
//# sourceMappingURL=helper.js.map