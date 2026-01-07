// services/s3.ts
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import ErrorHandler from "../helper/error.handler";

export type DownloadToFileInput = {
  bucket?: string;
  key: string;
  destinationPath: string;
};

export default class S3Service {
  private readonly client: S3Client;
  private readonly defaultBucket: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
        }
    });

    if (!process.env.S3_BUCKET) {
        throw new ErrorHandler({
            status_code: 500,
            message: "AWS_S3_BUCKET is not defined"
        })
    }

    this.defaultBucket = process.env.S3_BUCKET;
  }

  /**
   * Downloads an S3 object to a local file using streaming.
   * Safe for very large PDFs.
   */
  public downloadToFile = async (
    input: DownloadToFileInput
  ): Promise<void> => {
    const bucket = input.bucket ?? this.defaultBucket;

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: 'Acct Statement_XX2121_30122025.pdf'
      })
    );

    if (!response.Body) {
        throw new ErrorHandler({
            status_code: 500,
            message: "S3 object has no body"
        })
    }

    const writeStream = createWriteStream(input.destinationPath);

    await pipeline(
      response.Body as unknown as NodeJS.ReadableStream,
      writeStream
    );
  };
}
