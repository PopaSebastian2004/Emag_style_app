const pool = require("../db/pool");
const { generateRSS } = require("../utils/rss");
const { PORT } = require("../config/config");

module.exports = {
    // Genereaza feed-ul RSS cu top 5 cele mai apreciate si cele mai detestate entitati (clasament)
    async clasamentRSS(req, res) {
        try {
            // Selecteaza top 5 entitati cu cel mai mare rating mediu (minim 3 review-uri sau comentarii cu rating)
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
            // Selecteaza flop 5 entitati cu cel mai mic rating mediu (minim 3 review-uri sau comentarii cu rating)
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
            // Genereaza RSS XML si trimite raspunsul
            let now = new Date().toUTCString();
            let rss = generateRSS(top.rows, flop.rows, now, PORT);
            res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=UTF-8' });
            res.end(rss);
        } catch (err) {
            // In caz de eroare la generare sau query, returneaza raspuns 500
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
            res.end("Eroare RSS");
        }
    }
};