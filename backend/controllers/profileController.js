const bcrypt = require("bcrypt");
const pool = require("../db/pool");
const { generateJWT } = require("../utils/jwt");
const { setCookie } = require("../utils/cookie");
const { JWT_COOKIE_NAME } = require("../config/config");
const { sendResponse } = require("../utils/file");

module.exports = {
    async editProfile(req, res, user) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                let fields = [];
                let params = [];
                let idx = 1;
                if (data.username && data.username !== user.username) {
                    fields.push(`username = $${idx++}`); params.push(data.username);
                }
                if (data.email && data.email !== user.email) {
                    fields.push(`email = $${idx++}`); params.push(data.email);
                }
                if (data.password) {
                    const hash = await bcrypt.hash(data.password, 10);
                    fields.push(`password = $${idx++}`); params.push(hash);
                }
                if (!fields.length) return sendResponse(res, 200, "text/plain", "Nicio modificare.");
                params.push(user.id);
                await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`, params);

                const updatedUser = await pool.query("SELECT id, username, email FROM users WHERE id = $1", [user.id]);
                if (updatedUser.rows.length) {
                    const nu = updatedUser.rows[0];
                    const token = generateJWT({ id: nu.id, username: nu.username, email: nu.email });
                    setCookie(res, JWT_COOKIE_NAME, token, { path: "/", httpOnly: true, sameSite: true, maxAge: 60*60*2 });
                }
                sendResponse(res, 200, "text/plain", "Profilul a fost actualizat.");
            } catch (err) {
                sendResponse(res, 500, "text/plain", "Eroare la actualizarea profilului.");
            }
        });
    }
};