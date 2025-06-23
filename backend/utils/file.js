const path = require("path");

function sendResponse(res, status, ctype, data) {
    res.writeHead(status, { "Content-Type": ctype });
    res.end(data);
}

/**
 * Servește fișiere statice din frontend (html, css, js, etc)
 */

function serveStaticFile(res, filePath) {
    const fs = require("fs");
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


function parseMultipartData(req, boundary, callback) {
    let data = Buffer.alloc(0);
    req.on("data", chunk => { data = Buffer.concat([data, chunk]); });
    req.on("end", () => {
        const boundaryBuf = Buffer.from("--" + boundary);
        let parts = [];
        let start = data.indexOf(boundaryBuf) + boundaryBuf.length + 2; 
        while (start < data.length) {
            let end = data.indexOf(boundaryBuf, start) - 2; 
            if (end < 0) break;
            parts.push(data.slice(start, end));
            start = end + boundaryBuf.length + 4; 
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
                const originalName = filenameMatch[1];
                const mimeMatch = headerStr.match(/Content-Type: ([^;\r\n]+)/i);
                const mimetype = mimeMatch ? mimeMatch[1] : "application/octet-stream";
                files.push({ buffer: body, originalName, mimetype });
            } else {
                result[name] = body.toString().trim();
            }
        }
        callback(result, files);
    });
}

module.exports = { sendResponse, serveStaticFile, parseMultipartData };