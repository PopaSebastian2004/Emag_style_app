const path = require("path");
require("dotenv").config();

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET || "7065f81...", // fallback dacă nu există în env
    JWT_COOKIE_NAME: "jwt_token",
    TOKEN_EXPIRY: "2h",
    UPLOAD_DIR: path.join(__dirname, "../uploads"),
    PORT: process.env.PORT || 3008,
    DATABASE_URL: process.env.DATABASE_URL,
};