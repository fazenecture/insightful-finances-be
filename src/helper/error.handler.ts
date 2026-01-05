export default class ErrorHandler extends Error {
  status_code: number;
  message: string;
  data: any;

  constructor(errorObj: { status_code: number; message: string; data?: any }) {
    super();
    this.status_code = errorObj.status_code;
    this.message = errorObj.message;
    this.data = errorObj.data;
  }

  toString() {
    return {
      message: this.message,
      status_code: this.status_code,
      data: this.data,
    };
  }
}
