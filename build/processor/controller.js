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
const custom_error_1 = __importDefault(require("../helper/custom.error"));
const service_1 = __importDefault(require("./service"));
class ProcessorController extends service_1.default {
    constructor() {
        super(...arguments);
        this.execute = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { user_id, account_id, pdf_keys } = req.body;
                yield this.processPdfBatch({
                    userId: user_id,
                    accountId: account_id,
                    pdfKeys: pdf_keys
                });
                res.status(200).json({ message: "PDF batch processing initiated." });
            }
            catch (error) {
                (0, custom_error_1.default)(res, error);
            }
        });
        this.fetchAnalysisDataController = () => __awaiter(this, void 0, void 0, function* () {
            // 
        });
    }
}
exports.default = ProcessorController;
//# sourceMappingURL=controller.js.map