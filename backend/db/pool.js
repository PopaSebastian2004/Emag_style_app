const { Pool } = require("pg");
const { DATABASE_URL } = require("../config/config");

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

module.exports = pool;