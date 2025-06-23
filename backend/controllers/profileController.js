const bcrypt = require("bcrypt");
const pool = require("../db/pool");
const { generateJWT } = require("../utils/jwt");
const { setCookie } = require("../utils/cookie");
const { JWT_COOKIE_NAME } = require("../config/config");
const { sendResponse } = require("../utils/file");

module.exports = {
    // Editeaza profilul utilizatorului (username, email, parola).
    // Verifica unicitatea username/email, cripteaza parola noua daca este cazul,
    // si actualizeaza tokenul JWT daca datele s-au schimbat.
    async editProfile(req, res, user) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                let fields = [];
                let params = [];
                let idx = 1;

                // Verifica daca username-ul nou este unic (daca se doreste schimbarea lui)
                if (data.username && data.username !== user.username) {
                    const check = await pool.query("SELECT id FROM users WHERE username = $1", [data.username]);
                    if (check.rows.length && check.rows[0].id !== user.id) {
                        return sendResponse(res, 400, "text/plain", "Numele de utilizator exista deja.");
                    }
                    fields.push(`username = $${idx++}`); params.push(data.username);
                }

                // Verifica daca email-ul nou este unic (daca se doreste schimbarea lui)
                if (data.email && data.email !== user.email) {
                    const check = await pool.query("SELECT id FROM users WHERE email = $1", [data.email]);
                    if (check.rows.length && check.rows[0].id !== user.id) {
                        return sendResponse(res, 400, "text/plain", "Email-ul exista deja.");
                    }
                    fields.push(`email = $${idx++}`); params.push(data.email);
                }

                // Daca exista parola noua, cripteaza si o adauga la query
                if (data.password) {
                    const hash = await bcrypt.hash(data.password, 10);
                    fields.push(`password = $${idx++}`); params.push(hash);
                }
                // Daca nu s-a trimis niciun camp modificat, returneaza fara eroare
                if (!fields.length) return sendResponse(res, 200, "text/plain", "Nicio modificare.");
                params.push(user.id);
                await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`, params);

                // Daca s-a schimbat username/email, actualizeaza si tokenul JWT din cookie
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