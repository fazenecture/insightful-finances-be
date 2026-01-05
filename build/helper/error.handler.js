"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ErrorHandler extends Error {
    constructor(errorObj) {
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
exports.default = ErrorHandler;
//# sourceMappingURL=error.handler.js.map