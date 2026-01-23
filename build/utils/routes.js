"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = __importDefault(require("../utils/controller"));
const router = (0, express_1.Router)();
const { generatePreSignedUploadUrlController } = new controller_1.default();
// presigned upload url
router.post("/upload", generatePreSignedUploadUrlController);
exports.default = router;
//# sourceMappingURL=routes.js.map