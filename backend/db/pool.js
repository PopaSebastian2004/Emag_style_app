const { Pool } = require("pg");
const { DB } = require("../config/config");


const pool = typeof DB === "string"
  ? new Pool({ connectionString: DB, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false })
  : new Pool(DB);

module.exports = pool;