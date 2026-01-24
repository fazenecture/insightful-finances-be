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
// services/s3.ts
const client_s3_1 = require("@aws-sdk/client-s3");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:stream/promises");
const error_handler_1 = __importDefault(require("../helper/error.handler"));
const lib_storage_1 = require("@aws-sdk/lib-storage");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
class S3Service {
    constructor() {
        /**
         * Downloads an S3 object to a local file using streaming.
         * Safe for very large PDFs.
         */
        this.downloadToFile = (input) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const bucket = (_a = input.bucket) !== null && _a !== void 0 ? _a : this.defaultBucket;
            const response = yield this.client.send(new client_s3_1.GetObjectCommand({
                Bucket: bucket,
                Key: "Acct Statement_XX2121_30122025.pdf",
            }));
            if (!response.Body) {
                throw new error_handler_1.default({
                    status_code: 500,
                    message: "S3 object has no body",
                });
            }
            const writeStream = (0, node_fs_1.createWriteStream)(input.destinationPath);
            yield (0, promises_1.pipeline)(response.Body, writeStream);
        });
        this.uploadCsvStream = (key, stream) => __awaiter(this, void 0, void 0, function* () {
            const upload = new lib_storage_1.Upload({
                client: this.client,
                params: {
                    Bucket: this.defaultBucket,
                    Key: key,
                    Body: stream,
                    ContentType: "text/csv",
                },
            });
            yield upload.done();
        });
        this.getSignedDownloadUrl = (key) => {
            return (0, s3_request_presigner_1.getSignedUrl)(this.client, new client_s3_1.GetObjectCommand({
                Bucket: this.defaultBucket,
                Key: key,
            }), { expiresIn: 15 * 60 });
        };
        this.client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            },
        });
        if (!process.env.S3_BUCKET) {
            throw new error_handler_1.default({
                status_code: 500,
                message: "AWS_S3_BUCKET is not defined",
            });
        }
        this.defaultBucket = process.env.S3_BUCKET;
    }
}
exports.default = S3Service;
//# sourceMappingURL=s3.js.map