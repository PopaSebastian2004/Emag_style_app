const path = require("path");
const fs = require("fs");
const { parse: csvParse } = require("csv-parse/sync");
const pool = require("../db/pool");
const { sendResponse, parseMultipartData } = require("../utils/file");
const { UPLOAD_DIR } = require("../config/config");

module.exports = {
    async exportCSV(req, res) {
        try {
            const result = await pool.query(`SELECT r.*, u.username
                FROM reviews r JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC`);
            let csv = "id,entity,category,avg_rating,comment,username\n";
            for (let r of result.rows) {
                let avg = Number(r.rating);
                const comms = await pool.query(`SELECT rating FROM review_comments WHERE review_id = $1`, [r.id]);
                let count = 1;
                for (let c of comms.rows) {
                    if (c.rating) { avg += Number(c.rating); count++; }
                }
                avg = count > 0 ? avg / count : r.rating;
                csv += [
                    r.id,
                    `"${(r.entity||"").replace(/"/g, '""')}"`,
                    `"${(r.category||"").replace(/"/g, '""')}"`,
                    avg.toFixed(2),
                    `"${(r.comment||"").replace(/"/g, '""').replace(/\n/g," ")}"`,
                    `"${(r.username||"").replace(/"/g, '""')}"`
                ].join(",") + "\n";
            }
            sendResponse(res, 200, "text/csv", csv);
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Eroare la export CSV.");
        }
    },
   
    importCSV(req, res, user) {
        const contentType = req.headers["content-type"] || "";
        if (!contentType.startsWith("multipart/form-data")) {
            sendResponse(res, 400, "text/plain", "Invalid upload (CSV).");
            return;
        }
        const boundary = contentType.split("boundary=")[1];
        parseMultipartData(req, boundary, async (fields, files) => {
            if (!files.length || !files[0].buffer)
                return sendResponse(res, 400, "text/plain", "Niciun fișier CSV primit.");
            try {
                const data = files[0].buffer.toString("utf8"); // Citește direct din buffer!
                const rows = csvParse(data, { columns: true, skip_empty_lines: true });
                let inserted = 0, duplicate = 0, invalid = 0;
                for (const row of rows) {
                    if (!row.entity || !row.category || !row.comment) { invalid++; continue; }
                    const rating = Number(row.avg_rating || row.rating || 0);
                    if (isNaN(rating) || rating < 1 || rating > 5) { invalid++; continue; }
                    const exists = await pool.query(
                        "SELECT 1 FROM reviews WHERE user_id = $1 AND entity = $2 AND category = $3 LIMIT 1",
                        [user.id, row.entity, row.category]
                    );
                    if (exists.rows.length) { duplicate++; continue; }
                    try {
                        await pool.query(
                            "INSERT INTO reviews (user_id, entity, category, comment, rating) VALUES ($1, $2, $3, $4, $5)",
                            [user.id, row.entity, row.category, row.comment, rating]
                        );
                        inserted++;
                    } catch {}
                }
                sendResponse(
                    res, 200, "text/plain", 
                    `Import CSV reușit (${inserted} review-uri importate). Duplicate: ${duplicate}. Invalide: ${invalid}.`
                );
            } catch (err) {
                sendResponse(res, 500, "text/plain", "Eroare la import CSV.");
            }
        });
    },

    importJSON(req, res, user) {
        const contentType = req.headers["content-type"] || "";
        if (!contentType.startsWith("multipart/form-data")) {
            sendResponse(res, 400, "text/plain", "Invalid upload (JSON).");
            return;
        }
        const boundary = contentType.split("boundary=")[1];
        parseMultipartData(req, boundary, async (fields, files) => {
            if (!files.length || !files[0].buffer)
                return sendResponse(res, 400, "text/plain", "Niciun fișier JSON primit.");
            try {
                const data = files[0].buffer.toString("utf8");
                let arr = JSON.parse(data);
                if (!Array.isArray(arr)) arr = [arr];
                let inserted = 0, duplicate = 0, invalid = 0;
                for (const row of arr) {
                    if (!row.entity || !row.category || !row.comment) { invalid++; continue; }
                    const rating = Number(row.avg_rating || row.rating || 0);
                    if (isNaN(rating) || rating < 1 || rating > 5) { invalid++; continue; }
                    const exists = await pool.query(
                        "SELECT 1 FROM reviews WHERE user_id = $1 AND entity = $2 AND category = $3 LIMIT 1",
                        [user.id, row.entity, row.category]
                    );
                    if (exists.rows.length) { duplicate++; continue; }
                    try {
                        await pool.query(
                            "INSERT INTO reviews (user_id, entity, category, comment, rating) VALUES ($1, $2, $3, $4, $5)",
                            [user.id, row.entity, row.category, row.comment, rating]
                        );
                        inserted++;
                    } catch {}
                }
                sendResponse(
                    res, 200, "text/plain", 
                    `Import JSON reușit (${inserted} review-uri importate). Duplicate: ${duplicate}. Invalide: ${invalid}.`
                );
            } catch (err) {
                sendResponse(res, 500, "text/plain", "Eroare la import JSON.");
            }
        });
    }
};