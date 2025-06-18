const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { parse: csvParse } = require("csv-parse/sync");

const JWT_SECRET = "7065f81e8016f96aec9172d027f1f9e7e16225cd9231b6d6f229c3f112c43a08d8f2c053d74c7f1edb4626495a09e430ad3c9ca6c9f7ab613358550139a8484a";
const JWT_COOKIE_NAME = "jwt_token";
const TOKEN_EXPIRY = "2h";

// === CONFIG ===
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "web_app_reviews7",
    password: "global",
    port: 5432,
});

// === JWT Helpers ===
function setCookie(res, name, value, options = {}) {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.httpOnly) cookie += "; HttpOnly";
    if (options.sameSite) cookie += "; SameSite=Strict";
    res.setHeader("Set-Cookie", cookie);
}
function parseCookies(req) {
    const header = req.headers.cookie || "";
    return Object.fromEntries(header.split(";").map(c => c.trim().split("=").map(decodeURIComponent)));
}
function generateJWT(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
function verifyJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}
function getUserFromJWT(req) {
    const cookies = parseCookies(req);
    const token = cookies[JWT_COOKIE_NAME];
    if (!token) return null;
    const data = verifyJWT(token);
    if (!data) return null;
    return { id: data.id, username: data.username, email: data.email };
}

// === Helpers ===
function sendResponse(res, status, ctype, data) {
    res.writeHead(status, { "Content-Type": ctype });
    res.end(data);
}
function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}
function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
        ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    fs.readFile(filePath, (err, data) => {
        if (err) sendResponse(res, 404, "text/plain", "File Not Found");
        else {
            res.writeHead(200, { "Content-Type": contentType });
            res.end(data);
        }
    });
}
function serveUploadedFile(res, filePath) {
    const absPath = path.join(UPLOAD_DIR, filePath);
    if (!absPath.startsWith(UPLOAD_DIR)) {
        sendResponse(res, 403, "text/plain", "Forbidden");
        return;
    }
    fs.readFile(absPath, (err, data) => {
        if (err) sendResponse(res, 404, "text/plain", "File Not Found: " + absPath);
        else {
            const ext = path.extname(absPath).toLowerCase();
            const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" };
            res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
            res.end(data);
        }
    });
}

// === Multiform parser corect BINAR ===
function parseMultipartData(req, boundary, callback) {
    let data = Buffer.alloc(0);
    req.on("data", chunk => { data = Buffer.concat([data, chunk]); });
    req.on("end", () => {
        const boundaryBuf = Buffer.from("--" + boundary);
        let parts = [];
        let start = data.indexOf(boundaryBuf) + boundaryBuf.length + 2; // skip \r\n
        while (start < data.length) {
            let end = data.indexOf(boundaryBuf, start) - 2; // before \r\n
            if (end < 0) break;
            parts.push(data.slice(start, end));
            start = end + boundaryBuf.length + 4; // skip \r\n--
        }
        let result = {};
        let files = [];
        for (const part of parts) {
            const sep = part.indexOf("\r\n\r\n");
            if (sep === -1) continue;
            const headerStr = part.slice(0, sep).toString();
            const body = part.slice(sep + 4);
            const nameMatch = headerStr.match(/name="([^"]+)"/);
            if (!nameMatch) continue;
            const name = nameMatch[1];
            const filenameMatch = headerStr.match(/filename="([^"]+)"/);
            if (filenameMatch) {
                let ext = path.extname(filenameMatch[1]).toLowerCase();
                if (![".jpg", ".jpeg", ".png", ".gif", ".csv", ".json"].includes(ext)) ext = ".jpg";
                const fname = crypto.randomBytes(12).toString("hex") + ext;
                const absPath = path.join(UPLOAD_DIR, fname);
                fs.writeFileSync(absPath, body);
                files.push(fname);
            } else {
                result[name] = body.toString().trim();
            }
        }
        callback(result, files);
    });
}

// === ROUTER ===
async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method;
    const route = parsedUrl.pathname;
    const user = getUserFromJWT(req);

    // === STATIC, LOGIN, REGISTER ===
    if (route === "/" && method === "GET") {
        serveStaticFile(res, path.join(__dirname, "../frontend/pages/login.html"));
        return;
    }
    if (route === "/main" && method === "GET") {
        serveStaticFile(res, path.join(__dirname, "../frontend/pages/main.html"));
        return;
    }
    if (route.startsWith("/styles/") || route.startsWith("/scripts/") || route.startsWith("/pages/")) {
        const filePath = path.join(__dirname, "../frontend", route);
        serveStaticFile(res, filePath);
        return;
    }
    if (route.startsWith("/uploads/")) {
        serveUploadedFile(res, route.substring(9));
        return;
    }
    if (route === "/admin" && method === "GET") { 
        serveStaticFile(res, path.join(__dirname, "../frontend/pages/admin.html"));
        return;
    }

    // ===== EXPORT CSV (server-side, fresh data) =====
    if (route === "/export-csv" && method === "GET") {
        try {
            const result = await pool.query(`SELECT r.*, u.username
                FROM reviews r JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC`);
            let csv = "id,entity,category,avg_rating,comment,username\n";
            for (let r of result.rows) {
                // Calculează avg_rating (inclusiv comentarii)
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
        return;
    }

    // ===== IMPORT CSV =====
   if (route === "/import-csv" && method === "POST") {
    if (!user) return sendResponse(res, 401, "text/plain", "Neautorizat.");
    const contentType = req.headers["content-type"] || "";
    if (!contentType.startsWith("multipart/form-data")) {
        sendResponse(res, 400, "text/plain", "Invalid upload (CSV).");
        return;
    }
    const boundary = contentType.split("boundary=")[1];
    parseMultipartData(req, boundary, async (fields, files) => {
        if (!files.length) return sendResponse(res, 400, "text/plain", "Niciun fișier CSV primit.");
        const filePath = path.join(UPLOAD_DIR, files[0]);
        try {
            const data = fs.readFileSync(filePath, "utf8");
            const rows = csvParse(data, { columns: true, skip_empty_lines: true });
            let inserted = 0, duplicate = 0, invalid = 0;
            for (const row of rows) {
                if (!row.entity || !row.category || !row.comment) { invalid++; continue; }
                const rating = Number(row.avg_rating || row.rating || 0);
                // Verificare rating între 1 și 5
                if (isNaN(rating) || rating < 1 || rating > 5) { invalid++; continue; }
                // Verificare duplicate (același user, entitate și categorie)
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
            fs.unlinkSync(filePath);
            sendResponse(
                res, 200, "text/plain", 
                `Import CSV reușit (${inserted} review-uri importate). Duplicate: ${duplicate}. Invalide: ${invalid}.`
            );
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Eroare la import CSV.");
        }
    });
    return;
}
    // ===== IMPORT JSON =====
   if (route === "/import-json" && method === "POST") {
    if (!user) return sendResponse(res, 401, "text/plain", "Neautorizat.");
    const contentType = req.headers["content-type"] || "";
    if (!contentType.startsWith("multipart/form-data")) {
        sendResponse(res, 400, "text/plain", "Invalid upload (JSON).");
        return;
    }
    const boundary = contentType.split("boundary=")[1];
    parseMultipartData(req, boundary, async (fields, files) => {
        if (!files.length) return sendResponse(res, 400, "text/plain", "Niciun fișier JSON primit.");
        const filePath = path.join(UPLOAD_DIR, files[0]);
        try {
            const data = fs.readFileSync(filePath, "utf8");
            let arr = JSON.parse(data);
            if (!Array.isArray(arr)) arr = [arr];
            let inserted = 0, duplicate = 0, invalid = 0;
            for (const row of arr) {
                if (!row.entity || !row.category || !row.comment) { invalid++; continue; }
                const rating = Number(row.avg_rating || row.rating || 0);
                // Verificare rating între 1 și 5
                if (isNaN(rating) || rating < 1 || rating > 5) { invalid++; continue; }
                // Verificare duplicate (același user, entitate și categorie)
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
            fs.unlinkSync(filePath);
            sendResponse(
                res, 200, "text/plain", 
                `Import JSON reușit (${inserted} review-uri importate). Duplicate: ${duplicate}. Invalide: ${invalid}.`
            );
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Eroare la import JSON.");
        }
    });
    return;
}

   // REGISTER
if (route === "/register" && method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
        const { username, email, password } = qs.parse(body);
        if (!username || !email || !password)
            return sendResponse(res, 400, "application/json", JSON.stringify({error:"All fields required."}));
        try {
            // Verifica username sau email duplicat
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
    return;
}

// LOGIN
if (route === "/login" && method === "POST") {
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
            const token = generateJWT({ id: user.id, username: user.username, email: user.email });
            setCookie(res, JWT_COOKIE_NAME, token, { path: "/", httpOnly: true, sameSite: true, maxAge: 60*60*2 });
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        } catch (err) {
            sendResponse(res, 500, "application/json", JSON.stringify({error:"Login error."}));
        }
    });
    return;
}
    // LOGOUT
    if (route === "/logout" && method === "POST") {
        setCookie(res, JWT_COOKIE_NAME, "", { path: "/", httpOnly: true, sameSite: true, maxAge: 0 });
        sendResponse(res, 200, "text/plain", "Logged out.");
        return;
    }

    // CURRENT USER
    if (route === "/get-user" && method === "GET") {
        if (!user) return sendResponse(res, 401, "application/json", JSON.stringify({}));
        sendResponse(res, 200, "application/json", JSON.stringify({ username: user.username, id: user.id, email: user.email }));
        return;
    }

    // === RSS CLASAMENT ===
 if (route === "/clasament.rss" && method === "GET") {
    try {
        // TOP 5: entitate+categorie unic, review-uri + comentarii cu rating
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
        let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>Clasament entități - ReviewApp</title>
    <link>http://localhost:${port}/clasament.rss</link>
    <atom:link href="http://localhost:${port}/clasament.rss" rel="self" type="application/rss+xml" />
    <description>Clasamentul celor mai apreciate și detestate entități</description>
    <lastBuildDate>${now}</lastBuildDate>
    <item>
        <title>Top 5 Dezirabile</title>
        <description><![CDATA[<ol>
${top.rows.map(x=>
    `<li><span style="color:#2196f3;"><b>${x.category}</b></span> &mdash; <b>${x.entity}</b>: ${Number(x.avg_rating).toFixed(2)}/5 (${x.total_reviews} review-uri)</li>`
).join('\n')}
</ol>]]></description>
        <pubDate>${now}</pubDate>
        <guid isPermaLink="false">top5</guid>
    </item>
    <item>
        <title>Top 5 Detestate</title>
        <description><![CDATA[<ol>
${flop.rows.map(x=>
    `<li><span style="color:#2196f3;"><b>${x.category}</b></span> &mdash; <b>${x.entity}</b>: ${Number(x.avg_rating).toFixed(2)}/5 (${x.total_reviews} review-uri)</li>`
).join('\n')}
</ol>]]></description>
        <pubDate>${now}</pubDate>
        <guid isPermaLink="false">flop5</guid>
    </item>
</channel>
</rss>
`;
        res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=UTF-8' });
        res.end(rss);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end("Eroare RSS");
    }
    return;
}

    // === SECURED ROUTES BELOW (user must be authenticated) ===
    if (["/edit-profile", "/get-my-reviews", "/delete-review", "/get-my-comments", "/delete-comment", "/add-review", "/add-comment"].includes(route) && !user) {
        sendResponse(res, 401, "text/plain", "Neautorizat.");
        return;
    }

    // === PROFIL: Editare user ===
   if (route === "/edit-profile" && method === "POST") {
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

            // === Ia datele userului updatat și regenerează JWT ===
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
    return;
}
    // === REVIEW-URI SI COMENTARIILE MELE ===
    if (route === "/get-my-reviews" && method === "GET") {
        try {
            const result = await pool.query("SELECT * FROM reviews WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
            for (let r of result.rows) {
                const imgs = await pool.query("SELECT image_path FROM review_images WHERE review_id = $1", [r.id]);
                r.images = imgs.rows.map(img => "/uploads/" + img.image_path);
            }
            sendResponse(res, 200, "application/json", JSON.stringify(result.rows));
        } catch (err) {
            sendResponse(res, 500, "application/json", "[]");
        }
        return;
    }
    if (route === "/delete-review" && method === "DELETE") {
        const id = parsedUrl.query.id;
        if (!id) return sendResponse(res, 400, "text/plain", "Lipseste id-ul.");
        try {
            const imgs = await pool.query("SELECT image_path FROM review_images WHERE review_id=$1", [id]);
            for (const row of imgs.rows) {
                try { fs.unlinkSync(path.join(UPLOAD_DIR, row.image_path)); } catch {}
            }
            await pool.query("DELETE FROM review_images WHERE review_id=$1", [id]);
            await pool.query("DELETE FROM review_comments WHERE review_id=$1", [id]);
            await pool.query("DELETE FROM reviews WHERE id=$1 AND user_id=$2", [id, user.id]);
            sendResponse(res, 200, "text/plain", "Review șters.");
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Eroare la ștergere.");
        }
        return;
    }
    if (route === "/get-my-comments" && method === "GET") {
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
                c.images = imgs.rows.map(img => "/uploads/" + img.image_path);
            }
            sendResponse(res, 200, "application/json", JSON.stringify(result.rows));
        } catch (err) {
            sendResponse(res, 500, "application/json", "[]");
        }
        return;
    }
    if (route === "/delete-comment" && method === "DELETE") {
        const id = parsedUrl.query.id;
        if (!id) return sendResponse(res, 400, "text/plain", "Lipseste id-ul.");
        try {
            const imgs = await pool.query("SELECT image_path FROM comment_images WHERE comment_id=$1", [id]);
            for (const row of imgs.rows) {
                try { fs.unlinkSync(path.join(UPLOAD_DIR, row.image_path)); } catch {}
            }
            await pool.query("DELETE FROM comment_images WHERE comment_id=$1", [id]);
            await pool.query("DELETE FROM review_comments WHERE id=$1 AND user_id=$2", [id, user.id]);
            sendResponse(res, 200, "text/plain", "Comentariu șters.");
        } catch (err) {
            sendResponse(res, 500, "text/plain", "Eroare la ștergere.");
        }
        return;
    }

    // === OBTINE REVIEW-URI CU POZE SI COMENTARII (CU POZE) ===
    if (route === "/get-reviews" && method === "GET") {
        let sql = `SELECT r.*, u.username
            FROM reviews r
            JOIN users u ON r.user_id = u.id`;
        const params = [];
        if (parsedUrl.query.category) {
            sql += " WHERE r.category = $1";
            params.push(parsedUrl.query.category);
        } else if (parsedUrl.query.mine && user) {
            sql += " WHERE r.user_id = $1";
            params.push(user.id);
        }
        sql += " ORDER BY r.created_at DESC";
        try {
            const result = await pool.query(sql, params);
            for (let r of result.rows) {
                const imgs = await pool.query("SELECT image_path FROM review_images WHERE review_id = $1", [r.id]);
                r.images = imgs.rows.map(img => "/uploads/" + img.image_path);

                const comms = await pool.query(`SELECT c.*, u.username FROM review_comments c JOIN users u ON c.user_id = u.id WHERE c.review_id = $1 ORDER BY c.created_at ASC`, [r.id]);
                for (let c of comms.rows) {
                    const cimgs = await pool.query("SELECT image_path FROM comment_images WHERE comment_id = $1", [c.id]);
                    c.images = cimgs.rows.map(img => "/uploads/" + img.image_path);
                }
                r.comments = comms.rows;

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
        return;
    }

  if (route === "/add-review" && method === "POST") {
    const contentType = req.headers["content-type"] || "";
    if (contentType.startsWith("multipart/form-data")) {
        const boundary = contentType.split("boundary=")[1];
        parseMultipartData(req, boundary, async (fields, files) => {
            const { entity, category, comment, rating } = fields;
            if (!entity || !category || !comment || !rating)
                return sendResponse(res, 400, "text/plain", "All fields required.");
            try {
                // Verificare existenta
                const exists = await pool.query(
                    "SELECT 1 FROM reviews WHERE entity = $1 AND category = $2 LIMIT 1",
                    [entity, category]
                );
                if (exists.rows.length) {
                    return sendResponse(res, 400, "text/plain", "Exista deja acest produs in aceasta categorie!");
                }

                const result = await pool.query(
                    "INSERT INTO reviews (user_id, entity, category, comment, rating) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                    [user.id, entity, category, comment, rating]
                );
                const reviewId = result.rows[0].id;
                for (let fname of files.slice(0,3)) {
                    await pool.query("INSERT INTO review_images (review_id, image_path) VALUES ($1,$2)", [reviewId, fname]);
                }
                sendResponse(res, 200, "text/plain", "Review added.");
            } catch (err) {
                // Dacă baza de date dă eroare de constrângere unică
                if (err.code === '23505') {
                    return sendResponse(res, 400, "text/plain", "Exista deja acest produs in aceasta categorie!");
                }
                sendResponse(res, 500, "text/plain", "Error inserting review.");
            }
        });
    } else {
        sendResponse(res, 400, "text/plain", "Invalid upload.");
    }
    return;
}

    if (route === "/add-comment" && method === "POST") {
        const contentType = req.headers["content-type"] || "";
        if (contentType.startsWith("multipart/form-data")) {
            const boundary = contentType.split("boundary=")[1];
            parseMultipartData(req, boundary, async (fields, files) => {
                const { review_id, comment, rating } = fields;
                if (!review_id || !comment)
                    return sendResponse(res, 400, "text/plain", "All fields required.");
                try {
                    const result = await pool.query(
                        "INSERT INTO review_comments (review_id, user_id, comment, rating) VALUES ($1, $2, $3, $4) RETURNING id",
                        [review_id, user.id, comment, rating || null]
                    );
                    const commentId = result.rows[0].id;
                    for (let fname of files.slice(0,3)) {
                        await pool.query("INSERT INTO comment_images (comment_id, image_path) VALUES ($1, $2)", [commentId, fname]);
                    }
                    sendResponse(res, 200, "text/plain", "Comment added.");
                } catch (err) {
                    sendResponse(res, 500, "text/plain", "Error inserting comment.");
                }
            });
        } else {
            sendResponse(res, 400, "text/plain", "Invalid upload.");
        }
        return;
    }

    // === ADMIN ENDPOINTS ===
    if (route === "/admin/users" && method === "GET") {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        const users = await pool.query('SELECT id, username, email, "isAdmin" as isadmin FROM users');
        return sendResponse(res, 200, "application/json", JSON.stringify(users.rows));
    }
    if (route === "/admin/users" && method === "DELETE") {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { id } = JSON.parse(body);
            if (!id || id == user.id) return sendResponse(res, 400, "application/json", JSON.stringify({error:"Invalid user id."}));
            await pool.query("DELETE FROM users WHERE id = $1", [id]);
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        });
        return;
    }
    if (route === "/admin/reviews" && method === "GET") {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        const reviews = await pool.query("SELECT * FROM reviews");
        return sendResponse(res, 200, "application/json", JSON.stringify(reviews.rows));
    }
    if (route === "/admin/reviews" && method === "DELETE") {
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
        return;
    }
    if (route === "/admin/bug-reports" && method === "GET") {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        const bugs = await pool.query("SELECT bug_reports.*, users.username FROM bug_reports LEFT JOIN users ON bug_reports.user_id = users.id ORDER BY created_at DESC");
        return sendResponse(res, 200, "application/json", JSON.stringify(bugs.rows));
    }
    if (route === "/admin/bug-reports" && method === "DELETE") {
        if (!user || !(await isAdminUser(user.id))) return sendResponse(res, 403, "application/json", JSON.stringify({error:"Forbidden"}));
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { id } = JSON.parse(body);
            if (!id) return sendResponse(res, 400, "application/json", JSON.stringify({error:"Invalid bug report id."}));
            await pool.query("DELETE FROM bug_reports WHERE id=$1", [id]);
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        });
        return;
    }
    // === BUG REPORT SUBMISSION ===
    if (route === "/report-bug" && method === "POST") {
        if (!user) return sendResponse(res, 401, "application/json", JSON.stringify({error:"Not logged in"}));
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { description } = JSON.parse(body);
            if (!description) return sendResponse(res, 400, "application/json", JSON.stringify({error:"Description required"}));
            await pool.query("INSERT INTO bug_reports (user_id, description) VALUES ($1, $2)", [user.id, description]);
            sendResponse(res, 200, "application/json", JSON.stringify({success:true}));
        });
        return;
    }

    sendResponse(res, 404, "text/plain", "Not Found");
}

// Helper to check admin
async function isAdminUser(userId) {
    const result = await pool.query('SELECT "isAdmin" as isadmin FROM users WHERE id = $1', [userId]);
    return result.rows.length && result.rows[0].isadmin === true;
}
const port = 3008;
const server = http.createServer(handleRequest);
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});