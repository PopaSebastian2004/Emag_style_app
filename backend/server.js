const http = require("http");
const { PORT, UPLOAD_DIR } = require("./config/config");
const fs = require("fs");
const router = require("./controllers/router");


const server = http.createServer((req, res) => router(req, res));
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});