const http = require("http");
const { PORT, UPLOAD_DIR } = require("./config/config");
const fs = require("fs");
const router = require("./controllers/router");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const server = http.createServer((req, res) => router(req, res));
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});