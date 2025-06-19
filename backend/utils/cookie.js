function setCookie(res, name, value, options = {}) {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.httpOnly) cookie += "; HttpOnly";
    if (options.sameSite) cookie += "; SameSite=Strict";
    res.setHeader("Set-Cookie", cookie);
}
function parseCookies(req) {
    const header = req.headers.cookie || "";
    return Object.fromEntries(header.split(";").map(c => c.trim().split("=").map(decodeURIComponent)));
}
module.exports = { setCookie, parseCookies };