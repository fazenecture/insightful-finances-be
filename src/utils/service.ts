import UtilsHelper from "./helper";
import { IGenerateUploadUrlReqObj } from "./types/types";
import AWS from "aws-sdk";

export default class UtilsService extends UtilsHelper {
  private readonly _s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
  });

  public generatePreSignedUploadUrlService = async (
    reqObj: IGenerateUploadUrlReqObj
  ) => {
    const { file_name, mime_type, id } = reqObj;

    const sanitizedFileName = this.cleanFileName(file_name);
    const key = `${id}/${sanitizedFileName}`;

    const signedUrl = await this._s3.getSignedUrlPromise("putObject", {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Expires: 60,
      ContentType: mime_type,
    });

    return {
      signed_url: signedUrl,
      public_url: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      key,
    };
  };
}
