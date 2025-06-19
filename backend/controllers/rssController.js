const pool = require("../db/pool");
const { generateRSS } = require("../utils/rss");
const { PORT } = require("../config/config");

module.exports = {
    async clasamentRSS(req, res) {
        try {
            const top = await pool.query(`
                SELECT entity, category, AVG(rating) AS avg_rating, COUNT(*) AS total_reviews
                FROM (
                    SELECT entity, category, rating FROM reviews
                    UNION ALL
                    SELECT r.entity, r.category, c.rating FROM review_comments c
                    JOIN reviews r ON c.review_id = r.id
                    WHERE c.rating IS NOT NULL
                ) AS all_ratings
                GROUP BY entity, category
                HAVING COUNT(*) > 2
                ORDER BY avg_rating DESC
                LIMIT 5
            `);
            const flop = await pool.query(`
                SELECT entity, category, AVG(rating) AS avg_rating, COUNT(*) AS total_reviews
                FROM (
                    SELECT entity, category, rating FROM reviews
                    UNION ALL
                    SELECT r.entity, r.category, c.rating FROM review_comments c
                    JOIN reviews r ON c.review_id = r.id
                    WHERE c.rating IS NOT NULL
                ) AS all_ratings
                GROUP BY entity, category
                HAVING COUNT(*) > 2
                ORDER BY avg_rating ASC
                LIMIT 5
            `);
            let now = new Date().toUTCString();
            let rss = generateRSS(top.rows, flop.rows, now, PORT);
            res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=UTF-8' });
            res.end(rss);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
            res.end("Eroare RSS");
        }
    }
};