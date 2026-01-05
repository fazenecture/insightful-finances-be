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
class UtilsController extends service_1.default {
    constructor() {
        super(...arguments);
        this.generatePreSignedUploadUrlController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { file_name, mime_type, id } = req.body;
                const data = yield this.generatePreSignedUploadUrlService({
                    file_name,
                    mime_type,
                    id,
                });
                res.status(200).send({
                    success: true,
                    data,
                });
            }
            catch (err) {
                (0, custom_error_1.default)(res, err);
            }
        });
    }
}
exports.default = UtilsController;
//# sourceMappingURL=controller.js.map