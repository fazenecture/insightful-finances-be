import ErrorHandler from "../helper/error.handler";
import UtilsDB from "./db";

export default class UtilsHelper extends UtilsDB {
  protected cleanFileName = (filename: string): string => {
    if (!filename.length) {
      throw new ErrorHandler({
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
