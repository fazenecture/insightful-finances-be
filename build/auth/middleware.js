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
exports.validateLogin = exports.validateSignUp = void 0;
const joi_1 = __importDefault(require("joi"));
const validateSignUp = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bodySchema = joi_1.default.object({
            full_name: joi_1.default.string().min(3).max(100).required(),
            email: joi_1.default.string().email().required(),
            password: joi_1.default.string().min(6).max(128).required(),
        });
        req.body = yield bodySchema.validateAsync(req.body);
        next();
    }
    catch (error) {
        res.status(400).send({
            success: false,
            message: "Validation failed",
            errors: error.details.map((detail) => detail.message),
        });
    }
});
exports.validateSignUp = validateSignUp;
const validateLogin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bodySchema = joi_1.default.object({
            email: joi_1.default.string().email().required(),
            password: joi_1.default.string().min(6).max(128).required(),
        });
        req.body = yield bodySchema.validateAsync(req.body);
        next();
    }
    catch (error) {
        res.status(400).send({
            success: false,
            message: "Validation failed",
            errors: error.details.map((detail) => detail.message),
        });
    }
});
exports.validateLogin = validateLogin;
//# sourceMappingURL=middleware.js.map