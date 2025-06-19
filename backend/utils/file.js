const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { UPLOAD_DIR } = require("../config/config");

function sendResponse(res, status, ctype, data) {
    res.writeHead(status, { "Content-Type": ctype });
    res.end(data);
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
        // Asigură existența folderului uploads la fiecare upload!
        if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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
                const fname = require("crypto").randomBytes(12).toString("hex") + ext;
                const absPath = path.join(UPLOAD_DIR, fname);
                // Creează recursiv folderul uploads dacă nu există!
                if (!fs.existsSync(path.dirname(absPath))) fs.mkdirSync(path.dirname(absPath), { recursive: true });
                fs.writeFileSync(absPath, body);
                files.push(fname);
            } else {
                result[name] = body.toString().trim();
            }
        }
        callback(result, files);
    });
}

module.exports = { sendResponse, serveStaticFile, serveUploadedFile, parseMultipartData };