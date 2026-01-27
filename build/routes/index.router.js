"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const routes_1 = __importDefault(require("../processor/routes"));
const routes_2 = __importDefault(require("../utils/routes"));
const routes_3 = __importDefault(require("../auth/routes"));
const router = (0, express_1.Router)();
router.use("/analysis", routes_1.default);
router.use("/utils", routes_2.default);
router.use("/auth", routes_3.default);
exports.default = router;
//# sourceMappingURL=index.router.js.map