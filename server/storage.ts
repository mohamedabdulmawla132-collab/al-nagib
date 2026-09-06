// Storage adapter: supports Cloudflare R2 / any S3-compatible bucket directly,
// with the original Manus Forge storage kept as a fallback.
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function getS3Config() {
  const endpoint = process.env.R2_ENDPOINT?.trim() || process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.R2_BUCKET?.trim() || process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || process.env.S3_SECRET_ACCESS_KEY?.trim();
  const region = process.env.R2_REGION?.trim() || process.env.S3_REGION?.trim() || "auto";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function getS3Client(config: ReturnType<typeof getS3Config>) {
  if (!config) return null;
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) return null;
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const s3Config = getS3Config();
  const s3 = getS3Client(s3Config);

  if (s3 && s3Config) {
    await s3.send(new PutObjectCommand({ Bucket: s3Config.bucket, Key: key, Body: data, ContentType: contentType }));
    return { key, url: `/manus-storage/${key}` };
  }

  const forge = getForgeConfig();
  if (!forge) throw new Error("Storage config missing: configure R2/S3 or Manus Forge storage");
  const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Forge storage presign failed (${presignResp.status})`);
  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResp.ok) throw new Error(`Storage upload failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const s3Config = getS3Config();
  const s3 = getS3Client(s3Config);
  if (s3 && s3Config) {
    // Import dynamically to keep the adapter compatible with the existing dependency set.
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: s3Config.bucket, Key: key }), { expiresIn: 300 });
  }

  const forge = getForgeConfig();
  if (!forge) throw new Error("Storage config missing: configure R2/S3 or Manus Forge storage");
  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status})`);
  const { url } = (await resp.json()) as { url: string };
  if (!url) throw new Error("Empty signed URL");
  return url;
}
