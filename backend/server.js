const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const crypto = require("crypto");

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

// === Sesiuni simple ===
const sessions = {};
const SESSION_COOKIE_NAME = "sid";
function parseCookies(req) {
    const header = req.headers.cookie || "";
    return Object.fromEntries(header.split(";").map(c => c.trim().split("=").map(decodeURIComponent)));
}
function setCookie(res, name, value, options = {}) {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
    if (options.path) cookie += `; Path=${options.path}`;
    res.setHeader("Set-Cookie", cookie);
}
function getSession(req, res) {
    const cookies = parseCookies(req);
    let sid = cookies[SESSION_COOKIE_NAME];
    let session = sid && sessions[sid];
    if (!session) {
        sid = crypto.randomBytes(16).toString("hex");
        sessions[sid] = { created: Date.now() };
        setCookie(res, SESSION_COOKIE_NAME, sid, { path: "/" });
        session = sessions[sid];
    }
    return session;
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
                if (![".jpg", ".jpeg", ".png", ".gif"].includes(ext)) ext = ".jpg";
                const fname = crypto.randomBytes(12).toString("hex") + ext;
                const absPath = path.join(UPLOAD_DIR, fname);
                fs.writeFileSync(absPath, body); // binary write!
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
    const session = getSession(req, res);

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

    if (route === "/register" && method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { username, email, password } = qs.parse(body);
            if (!username || !email || !password) return sendResponse(res, 400, "text/plain", "All fields required.");
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                await pool.query("INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [username, email, hashedPassword]);
                sendResponse(res, 200, "text/plain", "Registration successful.");
            } catch (err) {
                sendResponse(res, 500, "text/plain", "Error registering user.");
            }
        });
        return;
    }

    if (route === "/login" && method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk.toString());
        req.on("end", async () => {
            const { email, password } = qs.parse(body);
            if (!email || !password) return sendResponse(res, 400, "text/plain", "All fields required.");
            try {
                const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
                if (!result.rows.length) return sendResponse(res, 401, "text/plain", "Invalid email or password.");
                const user = result.rows[0];
                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) return sendResponse(res, 401, "text/plain", "Invalid email or password.");
                session.user = { id: user.id, username: user.username, email: user.email };
                redirect(res, "/main");
            } catch (err) {
                sendResponse(res, 500, "text/plain", "Login error.");
            }
        });
        return;
    }

    if (route === "/logout" && method === "POST") {
        delete session.user;
        sendResponse(res, 200, "text/plain", "Logged out.");
        return;
    }

    if (route === "/get-user" && method === "GET") {
        if (!session.user) return sendResponse(res, 401, "application/json", JSON.stringify({}));
        sendResponse(res, 200, "application/json", JSON.stringify({ username: session.user.username, id: session.user.id, email: session.user.email }));
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
        } else if (parsedUrl.query.mine && session.user) {
            sql += " WHERE r.user_id = $1";
            params.push(session.user.id);
        }
        sql += " ORDER BY r.created_at DESC";
        try {
            const result = await pool.query(sql, params);
            for (let r of result.rows) {
                // Imagini pentru review
                const imgs = await pool.query("SELECT image_path FROM review_images WHERE review_id = $1", [r.id]);
                r.images = imgs.rows.map(img => "/uploads/" + img.image_path);

                // Comentarii pentru review
                const comms = await pool.query(`SELECT c.*, u.username FROM review_comments c JOIN users u ON c.user_id = u.id WHERE c.review_id = $1 ORDER BY c.created_at ASC`, [r.id]);
                for (let c of comms.rows) {
                    const cimgs = await pool.query("SELECT image_path FROM comment_images WHERE comment_id = $1", [c.id]);
                    c.images = cimgs.rows.map(img => "/uploads/" + img.image_path);
                }
                r.comments = comms.rows;

                // Nota medie: review + toate notele din comentarii
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
        if (!session.user) return sendResponse(res, 401, "text/plain", "Not authenticated");
        const contentType = req.headers["content-type"] || "";
        if (contentType.startsWith("multipart/form-data")) {
            const boundary = contentType.split("boundary=")[1];
            parseMultipartData(req, boundary, async (fields, files) => {
                const { entity, category, comment, rating } = fields;
                if (!entity || !category || !comment || !rating)
                    return sendResponse(res, 400, "text/plain", "All fields required.");
                try {
                    const result = await pool.query(
                        "INSERT INTO reviews (user_id, entity, category, comment, rating) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                        [session.user.id, entity, category, comment, rating]
                    );
                    const reviewId = result.rows[0].id;
                    for (let fname of files.slice(0,3)) {
                        await pool.query("INSERT INTO review_images (review_id, image_path) VALUES ($1,$2)", [reviewId, fname]);
                    }
                    sendResponse(res, 200, "text/plain", "Review added.");
                } catch (err) {
                    sendResponse(res, 500, "text/plain", "Error inserting review.");
                }
            });
        } else {
            sendResponse(res, 400, "text/plain", "Invalid upload.");
        }
        return;
    }

    if (route === "/add-comment" && method === "POST") {
        if (!session.user) return sendResponse(res, 401, "text/plain", "Not authenticated");
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
                        [review_id, session.user.id, comment, rating || null]
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

    sendResponse(res, 404, "text/plain", "Not Found");
}

const port = 3007;
const server = http.createServer(handleRequest);
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});