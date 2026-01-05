"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const error_handler_1 = __importDefault(require("../helper/error.handler"));
const db_1 = __importDefault(require("./db"));
class UtilsHelper extends db_1.default {
    constructor() {
        super(...arguments);
        this.cleanFileName = (filename) => {
            if (!filename.length) {
                throw new error_handler_1.default({
                    message: "Filename cannot be empty",
                    status_code: 400,
                });
            }
            return filename
                .toLowerCase()
                .normalize("NFD") // Normalize accented characters
                .replace(/[\u0300-\u036f]/g, "") // Remove accents
                .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "") // Remove emojis
                .replace(/[^a-z0-9\s]/g, "") // Remove everything except lowercase letters, digits, and space
                .replace(/\s+/g, "_") // Replace spaces with underscores
                .replace(/_+/g, "_") // Collapse multiple underscores
                .trim();
        };
    }
}
exports.default = UtilsHelper;
//# sourceMappingURL=helper.js.map