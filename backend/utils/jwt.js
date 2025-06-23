const jwt = require("jsonwebtoken");
const { JWT_SECRET, TOKEN_EXPIRY, JWT_COOKIE_NAME } = require("../config/config");
const { parseCookies } = require("./cookie");

// Genereaza un token JWT cu payload-ul dat si expirare configurata
function generateJWT(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
// Verifica si decodeaza un token JWT; returneaza datele sau null daca tokenul nu este valid sau expirat
function verifyJWT(token) {
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
// Extrage user-ul din JWT-ul stocat in cookie, sau null daca nu exista/nu e valid
function getUserFromJWT(req) {
    const cookies = parseCookies(req);
    const token = cookies[JWT_COOKIE_NAME];
    if (!token) return null;
    const data = verifyJWT(token);
    if (!data) return null;
    return { id: data.id, username: data.username, email: data.email };
}

module.exports = { generateJWT, verifyJWT, getUserFromJWT };