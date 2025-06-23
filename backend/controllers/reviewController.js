const pool = require("../db/pool");
const { sendResponse, parseMultipartData } = require("../utils/file");
const { uploadBufferToS3, getS3Url, deleteFromS3 } = require("../utils/s3");

module.exports = {
    // Returneaza toate review-urile utilizatorului curent, inclusiv imaginile asociate
    async getMyReviews(req, res, user) {
        try {
            const result = await pool.query("SELECT * FROM reviews WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
            for (let r of result.rows) {
                const imgs = await pool.query("SELECT image_path FROM review_images WHERE review_id = $1", [r.id]);
                r.images = imgs.rows.map(img => getS3Url(img.image_path));
            }
            sendResponse(res, 200, "application/json", JSON.stringify(result.rows));
        } catch (err) {
            sendResponse(res, 500, "application/json", "[]");
        }
    },

    // Sterge un review si imaginile/comentariile asociate (inclusiv din S3)
    async deleteReview(req, res, user, query) {
        const id = query.id;
        if (!id) return sendResponse(res, 400, "text/plain", "Lipseste id-ul.");
        try {
            const imgs = await pool.query("SELECT image_path FROM review_images WHERE review_id=$1", [id]);
            for (const row of imgs.rows) {
                try { await deleteFromS3(row.image_path); } catch {}
            }
            await pool.query("DELETE FROM review_images WHERE review_id=$1", [id]);
            await pool.query("DELETE FROM review_comments WHERE review_id=$1", [id]);
            await pool.query("DELETE FROM reviews WHERE id=$1 AND user_id=$2", [id, user.id]);
            sendResponse(res, 200, "text/plain", "Review sters.");
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Eroare la stergere.");
        }
    },

    // Returneaza toate comentariile utilizatorului curent (cu imagini si info recenzie)
    async getMyComments(req, res, user) {
        try {
            const result = await pool.query(`
                SELECT c.*, r.entity, r.category
                FROM review_comments c
                JOIN reviews r ON c.review_id = r.id
                WHERE c.user_id = $1
                ORDER BY c.created_at DESC
            `, [user.id]);
            for (let c of result.rows) {
                const imgs = await pool.query("SELECT image_path FROM comment_images WHERE comment_id = $1", [c.id]);
                c.images = imgs.rows.map(img => getS3Url(img.image_path));
            }
            sendResponse(res, 200, "application/json", JSON.stringify(result.rows));
        } catch (err) {
            sendResponse(res, 500, "application/json", "[]");
        }
    },

    // Sterge un comentariu si imaginile asociate din S3
    async deleteComment(req, res, user, query) {
        const id = query.id;
        if (!id) return sendResponse(res, 400, "text/plain", "Lipseste id-ul.");
        try {
            const imgs = await pool.query("SELECT image_path FROM comment_images WHERE comment_id=$1", [id]);
            for (const row of imgs.rows) {
                try { await deleteFromS3(row.image_path); } catch {}
            }
            await pool.query("DELETE FROM comment_images WHERE comment_id=$1", [id]);
            await pool.query("DELETE FROM review_comments WHERE id=$1 AND user_id=$2", [id, user.id]);
            sendResponse(res, 200, "text/plain", "Comentariu sters.");
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Eroare la stergere.");
        }
    },

    // Returneaza toate review-urile (sau filtrat dupa categorie/user), cu comentarii si imagini (+ medie rating calculata)
    async getReviews(req, res, user, query) {
        let sql = `SELECT r.*, u.username
            FROM reviews r
            JOIN users u ON r.user_id = u.id`;
        const params = [];
        if (query.category) {
            sql += " WHERE r.category = $1";
            params.push(query.category);
        } else if (query.mine && user) {
            sql += " WHERE r.user_id = $1";
            params.push(user.id);
        }
        sql += " ORDER BY r.created_at DESC";
        try {
            const result = await pool.query(sql, params);
            for (let r of result.rows) {
                // Imagini review
                const imgs = await pool.query("SELECT image_path FROM review_images WHERE review_id = $1", [r.id]);
                r.images = imgs.rows.map(img => getS3Url(img.image_path));

                // Comentarii la review (cu imagini si user)
                const comms = await pool.query(
                    `SELECT c.*, u.username FROM review_comments c JOIN users u ON c.user_id = u.id WHERE c.review_id = $1 ORDER BY c.created_at ASC`, [r.id]);
                for (let c of comms.rows) {
                    const cimgs = await pool.query("SELECT image_path FROM comment_images WHERE comment_id = $1", [c.id]);
                    c.images = cimgs.rows.map(img => getS3Url(img.image_path));
                }
                r.comments = comms.rows;

                // Calculeaza media rating (review + comentarii cu rating)
                let total = Number(r.rating);
                let count = 1;
                for (let c of comms.rows) {
                    if (c.rating) {
                        total += Number(c.rating);
                        count++;
                    }
                }
                r.avg_rating = count > 0 ? total / count : r.rating;
            }
            sendResponse(res, 200, "application/json", JSON.stringify(result.rows));
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Failed to fetch reviews.");
        }
    },

    // Adauga un review nou (cu imagini, max 3, incarcate pe S3)
    addReview(req, res, user) {
        const contentType = req.headers["content-type"] || "";
        if (contentType.startsWith("multipart/form-data")) {
            const boundary = contentType.split("boundary=")[1];
            parseMultipartData(req, boundary, async (fields, files) => {
                const { entity, category, comment, rating } = fields;
                if (!entity || !category || !comment || !rating)
                    return sendResponse(res, 400, "text/plain", "All fields required.");
                try {
                    // Nu permite duplicate pe (entity, category)
                    const exists = await pool.query(
                        "SELECT 1 FROM reviews WHERE entity = $1 AND category = $2 LIMIT 1",
                        [entity, category]
                    );
                    if (exists.rows.length) {
                        return sendResponse(res, 400, "text/plain", "Exista deja acest produs in aceasta categorie!");
                    }
                    // Insereaza review-ul nou
                    const result = await pool.query(
                        "INSERT INTO reviews (user_id, entity, category, comment, rating) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                        [user.id, entity, category, comment, rating]
                    );
                    const reviewId = result.rows[0].id;

                    // Incarca max 3 imagini in S3 si le asociaza review-ului
                    for (let file of files.slice(0, 3)) {
                        try {
                            const key = await uploadBufferToS3(file.buffer, file.originalName, "reviews");
                            await pool.query("INSERT INTO review_images (review_id, image_path) VALUES ($1,$2)", [reviewId, key]);
                        } catch (imgErr) {
                            // Daca o imagine pica, nu blocheaza review-ul
                        }
                    }
                    sendResponse(res, 200, "text/plain", "Review added.");
                } catch (err) {
                    if (err.code === '23505') {
                        return sendResponse(res, 400, "text/plain", "Exista deja acest produs in aceasta categorie!");
                    }
                    sendResponse(res, 500, "text/plain", "Error inserting review.");
                }
            });
        } else {
            sendResponse(res, 400, "text/plain", "Invalid upload.");
        }
    },

    // Adauga un comentariu la un review (cu imagini, max 3)
    addComment(req, res, user) {
        const contentType = req.headers["content-type"] || "";
        if (contentType.startsWith("multipart/form-data")) {
            const boundary = contentType.split("boundary=")[1];
            parseMultipartData(req, boundary, async (fields, files) => {
                const { review_id, comment, rating } = fields;
                if (!review_id || !comment)
                    return sendResponse(res, 400, "text/plain", "All fields required.");
                try {
                    // Insereaza comentariul
                    const result = await pool.query(
                        "INSERT INTO review_comments (review_id, user_id, comment, rating) VALUES ($1, $2, $3, $4) RETURNING id",
                        [review_id, user.id, comment, rating || null]
                    );
                    const commentId = result.rows[0].id;
                    // Incarca max 3 imagini asociate comentariului
                    for (let file of files.slice(0,3)) {
                        const key = await uploadBufferToS3(file.buffer, file.originalName, "comments");
                        await pool.query("INSERT INTO comment_images (comment_id, image_path) VALUES ($1, $2)", [commentId, key]);
                    }
                    sendResponse(res, 200, "text/plain", "Comment added.");
                } catch (err) {
                    sendResponse(res, 500, "text/plain", "Error inserting comment.");
                }
            });
        } else {
            sendResponse(res, 400, "text/plain", "Invalid upload.");
        }
    }
};