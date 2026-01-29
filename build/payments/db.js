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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const postgres_1 = __importDefault(require("../config/postgres"));
class PaymentsDb {
    constructor() {
        this.insertPaymentsDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const query = postgres_1.default.format(`INSERT INTO payments ? RETURNING *`, obj);
            const { rows } = yield postgres_1.default.query(query);
            return rows[0];
        });
        this.fetchPaymentsByUUID = (obj) => __awaiter(this, void 0, void 0, function* () {
            const client = (obj === null || obj === void 0 ? void 0 : obj.dbClient) || postgres_1.default;
            const { uuid } = obj;
            const query = `SELECT * FROM payments WHERE uuid = $1 LIMIT 1`;
            const values = [uuid];
            const { rows } = yield client.query(query, values);
            return rows[0];
        });
        this.updatePaymentById = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { uuid } = obj, rest = __rest(obj, ["uuid"]);
            const client = (obj === null || obj === void 0 ? void 0 : obj.dbClient) || postgres_1.default;
            const query = client.format(`UPDATE payments SET ? WHERE uuid = $1 RETURNING *`, rest);
            const values = [uuid];
            const { rows } = yield postgres_1.default.query(query, values);
            return rows[0];
        });
        this.updateUserTokensDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { user_id } = obj, rest = __rest(obj, ["user_id"]);
            const query = postgres_1.default.format(`UPDATE user_tokens SET ? WHERE user_id = $1`, rest);
            yield postgres_1.default.query(query, [user_id]);
        });
        this.incrementUserTokensDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { user_id, paid_tokens_granted } = obj;
            const query = `
      UPDATE user_tokens 
      SET paid_tokens_granted = paid_tokens_granted + $1,
          updated_at = NOW()
      WHERE user_id = $2
    `;
            const client = (obj === null || obj === void 0 ? void 0 : obj.dbClient) || postgres_1.default;
            yield client.query(query, [paid_tokens_granted, user_id]);
        });
    }
}
exports.default = PaymentsDb;
//# sourceMappingURL=db.js.map