const qs = require("querystring");
const bcrypt = require("bcrypt");
const pool = require("../db/pool");
const { generateJWT } = require("../utils/jwt");
const { setCookie } = require("../utils/cookie");
const { JWT_COOKIE_NAME } = require("../config/config");
const { sendResponse } = require("../utils/file");

module.exports = {
    // Inregistreaza un nou utilizator. Verifica daca username sau email exista deja, apoi salveaza userul cu parola criptata.
    async register(req, res) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { username, email, password } = qs.parse(body);
            if (!username || !email || !password)
                return sendResponse(res, 400, "application/json", JSON.stringify({error:"All fields required."}));
            try {
                const check = await pool.query("SELECT 1 FROM users WHERE username=$1 OR email=$2 LIMIT 1", [username, email]);
                if (check.rows.length)
                    return sendResponse(res, 400, "application/json", JSON.stringify({error:"Username sau email deja existent!"}));
                const hashedPassword = await bcrypt.hash(password, 10);
                await pool.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [username, email, hashedPassword]);
                sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
            } catch (err) {
                sendResponse(res, 500, "application/json", JSON.stringify({error:"Error registering user."}));
            }
        });
    },

    // Login utilizator: verifica daca exista user cu email, compara parola, seteaza cookie JWT daca e corect
    async login(req, res) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { email, password } = qs.parse(body);
            if (!email || !password)
                return sendResponse(res, 400, "application/json", JSON.stringify({error:"All fields required."}));
            try {
                const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
                if (!result.rows.length)
                    return sendResponse(res, 401, "application/json", JSON.stringify({error:"Invalid email or password."}));
                const user = result.rows[0];
                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid)
                    return sendResponse(res, 401, "application/json", JSON.stringify({error:"Invalid email or password."}));
                // Genereaza token JWT si seteaza cookie pentru sesiune
                const token = generateJWT({ id: user.id, username: user.username, email: user.email });
                setCookie(res, JWT_COOKIE_NAME, token, { path: "/", httpOnly: true, sameSite: true, maxAge: 60*60*2 });
                sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
            } catch (err) {
                sendResponse(res, 500, "application/json", JSON.stringify({error:"Login error."}));
            }
        });
    },

    // Logout: sterge cookie-ul JWT
    logout(req, res) {
        setCookie(res, JWT_COOKIE_NAME, "", { path: "/", httpOnly: true, sameSite: true, maxAge: 0 });
        sendResponse(res, 200, "text/plain", "Logged out.");
    },

    // Returneaza datele userului curent daca este logat (username, id, email)
    getUser(req, res, user) {
        if (!user) return sendResponse(res, 401, "application/json", JSON.stringify({}));
        sendResponse(res, 200, "application/json", JSON.stringify({ username: user.username, id: user.id, email: user.email }));
    },
};