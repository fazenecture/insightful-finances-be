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
exports.authValidation = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const service_1 = __importDefault(require("../auth/service"));
const enums_1 = require("../auth/types/enums");
const { PUBLIC_KEY, reGenerateTokens } = new service_1.default();
const authValidation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const token = ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]) || ((_b = req.query) === null || _b === void 0 ? void 0 : _b.token) || "";
        if (!(token === null || token === void 0 ? void 0 : token.length)) {
            res.status(401).send({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, PUBLIC_KEY, {
            algorithms: ["RS256"],
        });
        if ((decoded === null || decoded === void 0 ? void 0 : decoded.token_type) === enums_1.TokenType.ACCESS_TOKEN) {
            Object.assign(req.body, {
                user_id: decoded === null || decoded === void 0 ? void 0 : decoded.id,
                user_uuid: decoded === null || decoded === void 0 ? void 0 : decoded.uuid,
                is_active: decoded === null || decoded === void 0 ? void 0 : decoded.is_active,
            });
            next();
        }
        else if ((decoded === null || decoded === void 0 ? void 0 : decoded.token_type) === enums_1.TokenType.REFRESH_TOKEN) {
            const newTokens = yield reGenerateTokens(decoded);
            res.setHeader("x-new-access-token", newTokens.access_token);
            res.setHeader("x-new-refresh-token", newTokens.refresh_token);
            Object.assign(req.body, {
                user_id: newTokens.user.id,
                user_uuid: newTokens.user.uuid,
                is_active: newTokens.user.is_active,
            });
            next();
        }
        else {
            res.status(401).send({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
    }
    catch (error) {
        if (error.name === "TokenExpiredError") {
            res.status(401).json({
                success: false,
                message: "Unauthorized: Token expired",
            });
        }
        else {
            res.status(400).send({
                success: false,
                message: "Validation failed",
                errors: error,
            });
        }
    }
});
exports.authValidation = authValidation;
//# sourceMappingURL=auth.middleware.js.map