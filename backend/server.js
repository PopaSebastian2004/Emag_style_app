const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const bcrypt = require("bcrypt");
const { Pool } = require("pg"); 

// Configurare PostgreSQL
const pool = new Pool({
    user: "postgres",         // Numele utilizatorului PostgreSQL
    host: "localhost",        // Gazda serverului PostgreSQL
    database: "web_app_reviews3", // Numele bazei de date
    password: "global",       // Parola utilizatorului PostgreSQL
    port: 5432,               // Portul serverului PostgreSQL (implicit 5432)
});

// Helper pentru raspunsuri HTTP
function sendResponse(res, statusCode, contentType, data) {
    res.writeHead(statusCode, { "Content-Type": contentType });
    res.end(data);
}

// Helper pentru redirectionare
function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}

// Serveste fișiere statice
function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            sendResponse(res, 404, "text/plain", "File Not Found");
        } else {
            sendResponse(res, 200, contentType, data);
        }
    });
}

// Rute
function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method;
    const route = parsedUrl.pathname;

    // Rutele pentru pagini HTML
    if (route === "/" && method === "GET") {
        serveStaticFile(res, path.join(__dirname, "../frontend/pages/login.html"));
    } else if (route === "/main" && method === "GET") {
        serveStaticFile(res, path.join(__dirname, "../frontend/pages/main.html"));
    }

    // Rutele pentru fisiere statice (CSS, JS, imagini)
    else if (route.startsWith("/styles/") || route.startsWith("/scripts/") || route.startsWith("/pages/")) {
        const filePath = path.join(__dirname, "../frontend", route);
        serveStaticFile(res, filePath);
    }

    // Ruta pentru inregistrare utilizator
    else if (route === "/register" && method === "POST") {
        handleRegister(req, res);
    }

    // Ruta pentru autentificare utilizator
    else if (route === "/login" && method === "POST") {
        handleLogin(req, res);
    }

    // Ruta pentru obtinerea recenziilor
    else if (route === "/get-reviews" && method === "GET") {
        handleGetReviews(req, res, parsedUrl.query);
    }

    // Ruta pentru adaugarea unei recenzii
    else if (route === "/add-review" && method === "POST") {
        handleAddReview(req, res);
    }

    // Ruta pentru logout
    else if (route === "/logout" && method === "POST") {
        handleLogout(req, res);
    }

    // Dacă ruta nu este găsită
    else {
        sendResponse(res, 404, "text/plain", "Not Found");
    }
}

// Functiile pentru inregistrare, autentificare si alte procese
async function handleRegister(req, res) {
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        const { username, email, password } = qs.parse(body);

        if (!username || !email || !password) {
            sendResponse(res, 400, "text/plain", "All fields are required.");
            return;
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const query = "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)";
            await pool.query(query, [username, email, hashedPassword]);
            sendResponse(res, 200, "text/plain", "Registration successful.");
        } catch (err) {
            console.error("Database error during registration:", err);
            sendResponse(res, 500, "text/plain", "Error registering user.");
        }
    });
}

async function handleLogin(req, res) {
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        const { email, password } = qs.parse(body);

        if (!email || !password) {
            sendResponse(res, 400, "text/plain", "All fields are required.");
            return;
        }

        try {
            const query = "SELECT * FROM users WHERE email = $1";
            const result = await pool.query(query, [email]);

            if (result.rowCount === 0) {
                sendResponse(res, 401, "text/plain", "Invalid email or password.");
                return;
            }

            const user = result.rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (isValidPassword) {
                redirect(res, "/main");
            } else {
                sendResponse(res, 401, "text/plain", "Invalid email or password.");
            }
        } catch (err) {
            console.error("Database error during login:", err);
            sendResponse(res, 500, "text/plain", "Error logging in.");
        }
    });
}

async function handleGetReviews(req, res, query) {
    const category = query.category;
    let sqlQuery = `
        SELECT r.entity, r.category, r.rating, r.comment, u.username 
        FROM reviews r
        JOIN users u ON r.user_id = u.id
    `;
    const params = [];

    if (category) {
        sqlQuery += " WHERE r.category = $1";
        params.push(category);
    }

    try {
        const result = await pool.query(sqlQuery, params);
        sendResponse(res, 200, "application/json", JSON.stringify(result.rows));
    } catch (err) {
        console.error("Error fetching reviews:", err);
        sendResponse(res, 500, "text/plain", "Failed to fetch reviews.");
    }
}

async function handleAddReview(req, res) {
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", async () => {
        const { entity, category, rating, comment } = JSON.parse(body);

        if (!entity || !category || !rating || !comment) {
            sendResponse(res, 400, "text/plain", "All fields are required.");
            return;
        }

        try {
            const query = `
                INSERT INTO reviews (user_id, entity, category, rating, comment)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await pool.query(query, [1, entity, category, rating, comment]); // user_id este hardcodat pentru simplitate
            sendResponse(res, 200, "text/plain", "Review added successfully!");
        } catch (err) {
            console.error("Error adding review:", err);
            sendResponse(res, 500, "text/plain", "Failed to add review.");
        }
    });
}

function handleLogout(req, res) {
    sendResponse(res, 200, "text/plain", "Logged out successfully.");
}

// Crearea serverului
const port = 3003; // Actualizat pentru portul 3003
const server = http.createServer(handleRequest);
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});