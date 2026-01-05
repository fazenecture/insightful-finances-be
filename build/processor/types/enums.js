"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Currency = exports.Category = exports.TransactionSource = exports.TransactionDirection = void 0;
var TransactionDirection;
(function (TransactionDirection) {
    TransactionDirection["INFLOW"] = "inflow";
    TransactionDirection["OUTFLOW"] = "outflow";
})(TransactionDirection || (exports.TransactionDirection = TransactionDirection = {}));
var TransactionSource;
(function (TransactionSource) {
    TransactionSource["BANK"] = "bank";
    TransactionSource["UPI"] = "upi";
    TransactionSource["CREDIT_CARD"] = "credit_card";
})(TransactionSource || (exports.TransactionSource = TransactionSource = {}));
var Category;
(function (Category) {
    Category["FOOD"] = "Food & Dining";
    Category["SHOPPING"] = "Shopping";
    Category["TRANSPORT"] = "Transport";
    Category["ENTERTAINMENT"] = "Entertainment";
    Category["UTILITIES"] = "Utilities";
    Category["HOUSING"] = "Housing";
    Category["HEALTHCARE"] = "Healthcare";
    Category["EDUCATION"] = "Education";
    Category["INVESTMENT"] = "Investment";
    Category["INCOME"] = "Income";
    Category["FEES"] = "Fees & Charges";
    Category["TRANSFER"] = "Transfers";
    Category["OTHER"] = "Other";
})(Category || (exports.Category = Category = {}));
var Currency;
(function (Currency) {
    Currency["INR"] = "INR";
    Currency["USD"] = "USD";
    Currency["EUR"] = "EUR";
    Currency["GBP"] = "GBP";
    Currency["JPY"] = "JPY";
})(Currency || (exports.Currency = Currency = {}));
//# sourceMappingURL=enums.js.map