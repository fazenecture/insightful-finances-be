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
exports.callWithRateLimitRetry = void 0;
const logger_1 = __importDefault(require("./logger"));
const callWithRateLimitRetry = (fn_1, ...args_1) => __awaiter(void 0, [fn_1, ...args_1], void 0, function* (fn, maxRetries = 3) {
    var _a, _b;
    let attempt = 0;
    while (true) {
        try {
            return yield fn();
        }
        catch (err) {
            if ((err === null || err === void 0 ? void 0 : err.status) === 429 && attempt < maxRetries) {
                const retryAfterMs = Number((_b = (_a = err === null || err === void 0 ? void 0 : err.headers) === null || _a === void 0 ? void 0 : _a.get) === null || _b === void 0 ? void 0 : _b.call(_a, "retry-after-ms")) || 20000;
                logger_1.default.warn(`Rate limited. Retrying after ${retryAfterMs}ms...`);
                yield sleep(retryAfterMs);
                attempt++;
                continue;
            }
            throw err;
        }
    }
});
exports.callWithRateLimitRetry = callWithRateLimitRetry;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=api.retry.js.map