function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateRSS(top, flop, now, port) {
    return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>Clasament entități - ReviewApp</title>
    <link>http://localhost:${port}/clasament.rss</link>
    <atom:link href="http://localhost:${port}/clasament.rss" rel="self" type="application/rss+xml" />
    <description>Clasamentul celor mai apreciate și detestate entități</description>
    <lastBuildDate>${now}</lastBuildDate>
    <item>
        <title>Top 5 Dezirabile</title>
        <description><![CDATA[<ol>
${top.map(x=>
    `<li><span style="color:#2196f3;"><b>${escapeHTML(x.category)}</b></span> &mdash; <b>${escapeHTML(x.entity)}</b>: ${Number(x.avg_rating).toFixed(2)}/5 (${x.total_reviews} review-uri)</li>`
).join('\n')}
</ol>]]></description>
        <pubDate>${now}</pubDate>
        <guid isPermaLink="false">top5</guid>
    </item>
    <item>
        <title>Top 5 Detestate</title>
        <description><![CDATA[<ol>
${flop.map(x=>
    `<li><span style="color:#2196f3;"><b>${escapeHTML(x.category)}</b></span> &mdash; <b>${escapeHTML(x.entity)}</b>: ${Number(x.avg_rating).toFixed(2)}/5 (${x.total_reviews} review-uri)</li>`
).join('\n')}
</ol>]]></description>
        <pubDate>${now}</pubDate>
        <guid isPermaLink="false">flop5</guid>
    </item>
</channel>
</rss>`;
}
module.exports = { generateRSS };