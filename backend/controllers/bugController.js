const pool = require("../db/pool");
const { sendResponse } = require("../utils/file");

module.exports = {
    async report(req, res, user) {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { description } = JSON.parse(body);
            if (!description) return sendResponse(res, 400, "application/json", JSON.stringify({error:"Description required"}));
            await pool.query("INSERT INTO bug_reports (user_id, description) VALUES ($1, $2)", [user.id, description]);
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        });
    }
};