const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");
const session = require("express-session");
const path = require("path");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");

const app = express();
const port = 3001;

// Configure MySQL connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "global", // Înlocuiește cu parola ta MySQL
    database: "web_app_reviews3", // Asigură-te că baza de date există
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err.stack);
        return;
    }
    console.log("Connected to MySQL database.");
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend"))); // Servește fișierele statice (HTML, CSS, JS)
app.use(
    session({
        secret: "secret-key", // Cheie secretă pentru sesiuni
        resave: false,
        saveUninitialized: true,
    })
);

// Middleware pentru protejarea rutelor
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect("/"); // Redirecționează la pagina de login dacă utilizatorul nu este autentificat
    }
    next();
}

// Ruta principală: pagina de login
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

// Ruta protejată: pagina principală a aplicației
app.get("/main", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/pages/main.html"));
});

// Înregistrare utilizator
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).send("All fields are required.");
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        db.query(query, [username, email, hashedPassword], (err) => {
            if (err) {
                console.error("Database error during registration:", err);
                return res.status(500).send("Error registering user.");
            }
            res.redirect("/");
        });
    } catch (err) {
        console.error("Hashing error during registration:", err);
        res.status(500).send("Error hashing password.");
    }
});

// Autentificare utilizator
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send("All fields are required.");
    }

    const query = "SELECT * FROM users WHERE email = ?";
    db.query(query, [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).send("Invalid email or password.");
        }

        const user = results[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (isValidPassword) {
            req.session.userId = user.id;
            req.session.username = user.username;
            res.redirect("/main");
        } else {
            res.status(401).send("Invalid email or password.");
        }
    });
});

// Obține utilizatorul conectat
app.get("/get-user", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send({ error: "Not logged in" });
    }
    res.json({ username: req.session.username });
});

// Adaugă o recenzie
app.post("/add-review", requireLogin, (req, res) => {
    const { entity, category, rating, comment } = req.body;

    const query =
        "INSERT INTO reviews (user_id, entity, category, rating, comment) VALUES (?, ?, ?, ?, ?)";
    db.query(query, [req.session.userId, entity, category, rating, comment], (err) => {
        if (err) {
            console.error("Error adding review:", err);
            return res.status(500).send("Failed to add review.");
        }
        res.status(200).send("Review added successfully!");
    });
});

// Obține toate recenziile sau filtrate după categorie
app.get("/get-reviews", requireLogin, (req, res) => {
    const category = req.query.category;
    let query = `
        SELECT r.entity, r.category, r.rating, r.comment, u.username 
        FROM reviews r
        JOIN users u ON r.user_id = u.id
    `;

    if (category) {
        query += " WHERE r.category = ?";
        db.query(query, [category], (err, results) => {
            if (err) {
                console.error("Error filtering reviews:", err);
                return res.status(500).send("Failed to fetch filtered reviews.");
            }
            res.json(results);
        });
    } else {
        db.query(query, (err, results) => {
            if (err) {
                console.error("Error fetching reviews:", err);
                return res.status(500).send("Failed to fetch reviews.");
            }
            res.json(results);
        });
    }
});

// Exportă recenziile în format CSV
app.get("/export-csv", requireLogin, (req, res) => {
    const query = "SELECT * FROM reviews";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error exporting to CSV:", err);
            return res.status(500).send("Failed to export reviews.");
        }

        const json2csv = new Parser();
        const csv = json2csv.parse(results);
        res.header("Content-Type", "text/csv");
        res.attachment("reviews.csv");
        res.send(csv);
    });
});

// Exportă recenziile în format PDF
app.get("/export-pdf", requireLogin, (req, res) => {
    const query = "SELECT * FROM reviews";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error exporting to PDF:", err);
            return res.status(500).send("Failed to export reviews.");
        }

        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="reviews.pdf"');

        doc.pipe(res);
        doc.fontSize(16).text("Reviews", { underline: true });

        results.forEach((review) => {
            doc.fontSize(12).text(`Entity: ${review.entity}`);
            doc.text(`Category: ${review.category}`);
            doc.text(`Rating: ${review.rating}`);
            doc.text(`Comment: ${review.comment}`);
            doc.moveDown();
        });

        doc.end();
    });
});

// Logout utilizator
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out:", err);
            return res.status(500).send("Failed to logout.");
        }
        res.status(200).send("Logged out successfully.");
    });
});

// Pornirea serverului
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});