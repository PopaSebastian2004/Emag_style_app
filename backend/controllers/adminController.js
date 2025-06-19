const pool = require("../db/pool");
const { sendResponse } = require("../utils/file");

async function isAdminUser(userId) {
    const result = await pool.query('SELECT "isAdmin" as isadmin FROM users WHERE id = $1', [userId]);
    return result.rows.length && result.rows[0].isadmin === true;
}

module.exports = {
    async usersGet(req, res, user) {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        const users = await pool.query('SELECT id, username, email, "isAdmin" as isadmin FROM users');
        return sendResponse(res, 200, "application/json", JSON.stringify(users.rows));
    },
    async usersDelete(req, res, user) {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { id } = JSON.parse(body);
            if (!id || id == user.id) return sendResponse(res, 400, "application/json", JSON.stringify({error:"Invalid user id."}));
            await pool.query("DELETE FROM users WHERE id = $1", [id]);
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        });
    },
    async reviewsGet(req, res, user) {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        const reviews = await pool.query("SELECT * FROM reviews");
        return sendResponse(res, 200, "application/json", JSON.stringify(reviews.rows));
    },
    async reviewsDelete(req, res, user) {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { id } = JSON.parse(body);
            if (!id) return sendResponse(res, 400, "application/json", JSON.stringify({error:"Invalid review id."}));
            await pool.query("DELETE FROM review_images WHERE review_id=$1", [id]);
            await pool.query("DELETE FROM review_comments WHERE review_id=$1", [id]);
            await pool.query("DELETE FROM reviews WHERE id=$1", [id]);
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        });
    },
    async bugReportsGet(req, res, user) {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        const bugs = await pool.query("SELECT bug_reports.*, users.username FROM bug_reports LEFT JOIN users ON bug_reports.user_id = users.id ORDER BY created_at DESC");
        return sendResponse(res, 200, "application/json", JSON.stringify(bugs.rows));
    },
    async bugReportsDelete(req, res, user) {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { id } = JSON.parse(body);
            if (!id) return sendResponse(res, 400, "application/json", JSON.stringify({error:"Invalid bug report id."}));
            await pool.query("DELETE FROM bug_reports WHERE id=$1", [id]);
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        });
    }
};