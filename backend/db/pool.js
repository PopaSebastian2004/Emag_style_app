const { Pool } = require("pg");
const { DB } = require("../config/config");

const pool = new Pool(DB);
module.exports = pool;