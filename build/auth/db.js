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
class AuthDB {
    constructor() {
        this.fetchUserByEmailDb = (email) => __awaiter(this, void 0, void 0, function* () {
            const query = `SELECT * FROM users WHERE email = $1`;
            const { rows } = yield postgres_1.default.query(query, [email]);
            return rows[0];
        });
        this.fetchUserByIdDb = (id) => __awaiter(this, void 0, void 0, function* () {
            const query = `SELECT * FROM users WHERE id = $1`;
            const { rows } = yield postgres_1.default.query(query, [id]);
            return rows[0];
        });
        this.insertUserDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const query = postgres_1.default.format(`INSERT INTO users ? RETURNING *`, [obj]);
            const { rows } = yield postgres_1.default.query(query);
            return rows[0];
        });
        this.insertUserTokensDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const query = postgres_1.default.format(`INSERT INTO user_tokens ? RETURNING *`, [obj]);
            const { rows } = yield postgres_1.default.query(query);
            return rows[0];
        });
        this.updateUserByIdDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { id } = obj, rest = __rest(obj, ["id"]);
            const query = postgres_1.default.format(`UPDATE users SET ? WHERE id = $1`, rest);
            yield postgres_1.default.query(query, [id]);
        });
        this.updateUserByUUIDDb = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { uuid } = obj, rest = __rest(obj, ["uuid"]);
            const query = postgres_1.default.format(`UPDATE users SET ? WHERE uuid = $1`, [
                rest,
            ]);
            yield postgres_1.default.query(query, [uuid]);
        });
        this.fetchUserDetailsWithTokensByIdDb = (id) => __awaiter(this, void 0, void 0, function* () {
            const query = `
      SELECT 
        u.*, json_build_object(
          'id', ut.id,
          'user_id', ut.user_id,
          'free_tokens_granted', ut.free_tokens_granted,
          'free_tokens_used', ut.free_tokens_used,
          'paid_tokens_granted', ut.paid_tokens_granted,
          'paid_tokens_used', ut.paid_tokens_used,
          'total_tokens_used', ut.total_tokens_used,
          'total_tokens_granted', ut.total_tokens_granted,
          'total_net_tokens', ut.total_net_tokens
          ) AS user_tokens
      FROM 
        users u
      JOIN 
        user_tokens ut ON u.id = ut.user_id
      WHERE 
        u.id = $1
      LIMIT 1;
    `;
            const { rows } = yield postgres_1.default.query(query, [id]);
            return rows[0];
        });
        this.fetchUserDetailsWithTokensByEmailDb = (email) => __awaiter(this, void 0, void 0, function* () {
            const query = `
      SELECT 
        u.*, json_build_object(
          'id', ut.id,
          'user_id', ut.user_id,
          'free_tokens_granted', ut.free_tokens_granted,
          'free_tokens_used', ut.free_tokens_used,
          'paid_tokens_granted', ut.paid_tokens_granted,
          'paid_tokens_used', ut.paid_tokens_used,
          'total_tokens_used', ut.total_tokens_used,
          'total_tokens_granted', ut.total_tokens_granted,
          'total_net_tokens', ut.total_net_tokens
          ) AS user_tokens
      FROM 
        users u
      JOIN 
        user_tokens ut ON u.id = ut.user_id
      WHERE 
        u.email = $1
      LIMIT 1;
    `;
            const { rows } = yield postgres_1.default.query(query, [email]);
            return rows[0];
        });
    }
}
exports.default = AuthDB;
//# sourceMappingURL=db.js.map