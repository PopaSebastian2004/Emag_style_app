const path = require("path");

module.exports = {
    JWT_SECRET: "7065f81e8016f96aec9172d027f1f9e7e16225cd9231b6d6f229c3f112c43a08d8f2c053d74c7f1edb4626495a09e430ad3c9ca6c9f7ab613358550139a8484a",
    JWT_COOKIE_NAME: "jwt_token",
    TOKEN_EXPIRY: "2h",
    UPLOAD_DIR: path.join(__dirname, "../uploads"),
    PORT: 3008,
    DB: {
        user: "postgres",      
        host: "localhost",
        database: "web_app_reviews7",
        password: "global",   
        port: 5432,
    }
};