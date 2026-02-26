// services/s3Service.js
const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { randomUUID } = require("crypto");
const path = require("path");
const { envs } = require("../../constants/envs");


// const PUBLIC_URL_BASE = process.env.S3_PUBLIC_URL_BASE || `https://${BUCKET}.s3.amazonaws.com`; // override if needed

const AWS_REGION = envs.aws.region
const AWS_ACCESS_KEY_ID = envs.aws.accessKeyId
const AWS_SECRET_ACCESS_KEY = envs.aws.secretAccessKey
const BUCKET = envs.aws.s3Bucket
const PUBLIC_URL_BASE = envs.aws.s3PublicUrlBase;
console.log("S3 Config - Region:", AWS_REGION, "Bucket:", BUCKET, "Public URL Base:", PUBLIC_URL_BASE);


if (!BUCKET) {
    throw new Error("S3_BUCKET_NAME env var is required");
}

const s3 = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
});

class S3Service {
    /**
     * Upload a file buffer to S3.
     * @param {Buffer} buffer
     * @param {String} originalName
     * @param {String} mimeType
     * @param {String} folder - optional folder/prefix in bucket
     * @returns {Promise<{ key, url }>}
     */
    static async uploadFile(buffer, originalName, mimeType = "application/octet-stream", folder = "") {
        const ext = path.extname(originalName || "") || "";
        const key = `${folder ? folder.replace(/\/$/, "") + "/" : ""}${Date.now()}-${randomUUID()}${ext}`;
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            // ACL: "public-read" // your bucket is public; remove if using bucket policy instead
        });
        await s3.send(command);
        return { key, url: `${PUBLIC_URL_BASE}/${encodeURIComponent(key)}` };
    }

    /**
     * Delete a file by key
     * @param {String} key
     */
    static async deleteFile(key) {
        if (!key) return;
        const command = new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key
        });
        await s3.send(command);
        return true;
    }

    /**
     * Replace a file: upload newBuffer and delete oldKey (if provided).
     * @param {Buffer} newBuffer
     * @param {String} originalName
     * @param {String} mimeType
     * @param {String} oldKey
     * @param {String} folder
     * @returns {Promise<{ key, url }>}
     */
    static async replaceFile(newBuffer, originalName, mimeType, oldKey = null, folder = "") {
        const uploaded = await S3Service.uploadFile(newBuffer, originalName, mimeType, folder);
        if (oldKey) {
            try {
                await S3Service.deleteFile(oldKey);
            } catch (err) {
                // swallow or log; we don't want upload to fail because delete failed
                console.warn("Failed to delete old S3 key:", oldKey, err?.message || err);
            }
        }
        return uploaded;
    }

    /**
     * List objects under prefix (folder)
     * @param {String} prefix
     * @param {Number} maxKeys
     */
    static async listFiles(prefix = "", maxKeys = 100) {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            MaxKeys: maxKeys
        });
        const resp = await s3.send(command);
        const items = (resp.Contents || []).map(c => ({
            key: c.Key,
            lastModified: c.LastModified,
            size: c.Size,
            url: `${PUBLIC_URL_BASE}/${encodeURIComponent(c.Key)}`
        }));
        return items;
    }

    static getPublicUrl(key) {
        if (!key) return null;
        return `${PUBLIC_URL_BASE}/${encodeURIComponent(key)}`;
    }
}

module.exports = S3Service;