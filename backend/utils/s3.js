const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const path = require("path");


const S3 = {
    region: "eu-north-1",
    bucket: "popasebastian-review-app",
    accessKeyId: "AKIAWKY5XIMBOYPKDEHS",
    secretAccessKey: "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"
};

const s3 = new S3Client({
    region: S3.region,
    credentials: {
        accessKeyId: S3.accessKeyId,
        secretAccessKey: S3.secretAccessKey,
    }
});

function getS3Url(key) {
    return `https://${S3.bucket}.s3.${S3.region}.amazonaws.com/${key}`;
}

async function uploadBufferToS3(buffer, originalName, folder = "") {
    const ext = path.extname(originalName).toLowerCase() || ".jpg";
    const key = (folder ? (folder + "/") : "") + crypto.randomBytes(16).toString("hex") + ext;
    await s3.send(new PutObjectCommand({
        Bucket: S3.bucket,
        Key: key,
        Body: buffer,
        ContentType: ext === ".png" ? "image/png" : "image/jpeg"
    }));
    return key;
}

async function deleteFromS3(key) {
    await s3.send(new DeleteObjectCommand({
        Bucket: S3.bucket,
        Key: key
    }));
}

module.exports = { uploadBufferToS3, getS3Url, deleteFromS3 };