const url = require("url");
const path = require("path");
const { getUserFromJWT } = require("../utils/jwt");
const { serveStaticFile, serveUploadedFile, sendResponse } = require("../utils/file");

// Controllers
const authController = require("./authController");
const profileController = require("./profileController");
const reviewController = require("./reviewController");
const importExportController = require("./importExportController");
const adminController = require("./adminController");
const bugController = require("./bugController");
const rssController = require("./rssController");

module.exports = async function router(req, res, projectRoot) {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method;
    const route = decodeURIComponent(parsedUrl.pathname);
    const user = getUserFromJWT(req);

    // STATIC & UPLOADS
    if (route === "/" && method === "GET")
        return serveStaticFile(res, path.join(projectRoot, "frontend/pages/login.html"));
    if (route === "/main" && method === "GET")
        return serveStaticFile(res, path.join(projectRoot, "frontend/pages/main.html"));
    if (route === "/admin" && method === "GET")
        return serveStaticFile(res, path.join(projectRoot, "frontend/pages/admin.html"));
    if (
        route.startsWith("/pages/") ||
        route.startsWith("/styles/") ||
        route.startsWith("/scripts/")
    )
        return serveStaticFile(res, path.join(projectRoot, "frontend", route));
    if (route.startsWith("/uploads/"))
        return serveUploadedFile(res, route.substring(9));

    // AUTH
    if (route === "/register" && method === "POST") return authController.register(req, res);
    if (route === "/login" && method === "POST") return authController.login(req, res);
    if (route === "/logout" && method === "POST") return authController.logout(req, res);
    if (route === "/get-user" && method === "GET") return authController.getUser(req, res, user);

    // PROFILE
    if (route === "/edit-profile" && method === "POST")
        return user
            ? profileController.editProfile(req, res, user)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");

    // REVIEWS & IMPORT/EXPORT
    if (route === "/export-csv" && method === "GET")
        return importExportController.exportCSV(req, res);
    if (route === "/import-csv" && method === "POST")
        return user
            ? importExportController.importCSV(req, res, user)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");
    if (route === "/import-json" && method === "POST")
        return user
            ? importExportController.importJSON(req, res, user)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");

    // RSS
    if (route === "/clasament.rss" && method === "GET")
        return rssController.clasamentRSS(req, res);

    // USER REVIEWS/COMMENTS
    if (route === "/get-my-reviews" && method === "GET")
        return user
            ? reviewController.getMyReviews(req, res, user)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");
    if (route === "/delete-review" && method === "DELETE")
        return user
            ? reviewController.deleteReview(req, res, user, parsedUrl.query)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");
    if (route === "/get-my-comments" && method === "GET")
        return user
            ? reviewController.getMyComments(req, res, user)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");
    if (route === "/delete-comment" && method === "DELETE")
        return user
            ? reviewController.deleteComment(req, res, user, parsedUrl.query)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");

    // PUBLIC REVIEWS
    if (route === "/get-reviews" && method === "GET")
        return reviewController.getReviews(req, res, user, parsedUrl.query);
    if (route === "/add-review" && method === "POST")
        return user
            ? reviewController.addReview(req, res, user)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");
    if (route === "/add-comment" && method === "POST")
        return user
            ? reviewController.addComment(req, res, user)
            : sendResponse(res, 401, "text/plain", "Neautorizat.");

    // ADMIN
    if (route === "/admin/users" && method === "GET")
        return adminController.usersGet(req, res, user);
    if (route === "/admin/users" && method === "DELETE")
        return adminController.usersDelete(req, res, user);
    if (route === "/admin/reviews" && method === "GET")
        return adminController.reviewsGet(req, res, user);
    if (route === "/admin/reviews" && method === "DELETE")
        return adminController.reviewsDelete(req, res, user);
    if (route === "/admin/bug-reports" && method === "GET")
        return adminController.bugReportsGet(req, res, user);
    if (route === "/admin/bug-reports" && method === "DELETE")
        return adminController.bugReportsDelete(req, res, user);

    // BUG
    if (route === "/report-bug" && method === "POST")
        return user
            ? bugController.report(req, res, user)
            : sendResponse(res, 401, "application/json", JSON.stringify({ error: "Not logged in" }));

    // 404
    sendResponse(res, 404, "text/plain", "Not Found");
};