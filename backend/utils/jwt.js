const jwt = require("jsonwebtoken");
const { JWT_SECRET, TOKEN_EXPIRY, JWT_COOKIE_NAME } = require("../config/config");
const { parseCookies } = require("./cookie");

function generateJWT(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
function verifyJWT(token) {
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function getUserFromJWT(req) {
    const cookies = parseCookies(req);
    const token = cookies[JWT_COOKIE_NAME];
    if (!token) return null;
    const data = verifyJWT(token);
    if (!data) return null;
    return { id: data.id, username: data.username, email: data.email };
}
module.exports = { generateJWT, verifyJWT, getUserFromJWT };