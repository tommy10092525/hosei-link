import { nanoid } from "nanoid";

import type { Bindings } from "./env";

/**
 * R2 への画像の出し入れ。
 *
 * 旧実装は base64 データURLを受け取って Cloudflare Images の REST API に
 * 転送していた (lib/server.ts)。ここではバインディング経由で R2 に直接置く。
 * 変換・リサイズは行わない (要件で許容済み) ので、縮小はアップロード前に
 * クライアント側の browser-image-compression で行う。
 */

/** 旧実装と同じ 10MB 制限 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export class UploadError extends Error {}

/**
 * アップロードされた File を R2 に保存し、オブジェクトキーを返す。
 * DB には URL ではなくこのキーだけを保存し、配信方法を後から変えられるようにする。
 */
export const putImage = async (
  env: Bindings,
  file: File,
  prefix: "posts" | "avatars" | "messages",
): Promise<string> => {
  const extension = EXTENSION_BY_MIME[file.type];
  if (!extension) {
    throw new UploadError("対応していない画像形式です (jpeg/png/webp/gif/avif)");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UploadError("ファイルサイズが大きすぎます (最大10MB)");
  }

  const key = `${prefix}/${nanoid()}.${extension}`;
  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  return key;
};

/** 参照されなくなったオブジェクトを消す。失敗しても呼び出し側の処理は止めない */
export const deleteImages = async (env: Bindings, keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  try {
    await env.BUCKET.delete(keys);
  } catch {
    // 孤児オブジェクトが残るだけなので、本処理は続行させる
  }
};

/**
 * R2 のオブジェクトを配信する。
 * キーは内容ごとに一意 (nanoid) なので不変キャッシュにできる。
 */
export const serveImage = async (env: Bindings, key: string): Promise<Response> => {
  const object = await env.BUCKET.get(key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
};
