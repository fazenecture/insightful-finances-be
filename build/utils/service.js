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
const helper_1 = __importDefault(require("./helper"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
class UtilsService extends helper_1.default {
    constructor() {
        super(...arguments);
        this._s3 = new aws_sdk_1.default.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
        });
        this.generatePreSignedUploadUrlService = (reqObj) => __awaiter(this, void 0, void 0, function* () {
            const { file_name, mime_type, id } = reqObj;
            const sanitizedFileName = this.cleanFileName(file_name);
            const key = `${id}/${sanitizedFileName}`;
            const signedUrl = yield this._s3.getSignedUrlPromise("putObject", {
                Bucket: process.env.S3_BUCKET,
                Key: key,
                Expires: 60,
                ContentType: mime_type,
            });
            return {
                signed_url: signedUrl,
                public_url: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
                key,
            };
        });
    }
}
exports.default = UtilsService;
//# sourceMappingURL=service.js.map