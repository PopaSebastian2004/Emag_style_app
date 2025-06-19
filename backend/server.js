const http = require("http");
const path = require("path");
const { PORT, UPLOAD_DIR } = require("./config/config");
const fs = require("fs");
const router = require("./controllers/router");

// projectRoot este rădăcina proiectului, cu un nivel mai sus față de backend/
const projectRoot = path.join(process.cwd(), "..");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const server = http.createServer((req, res) => router(req, res, projectRoot));
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});