/**
 * 旧 Cloudflare Images の画像を R2 へ移す。
 *
 * 旧実装は画像を Cloudflare Images に置き、配信URLを DB に保存していた。
 * 新実装は R2 にオブジェクトを置き、DB にはキーだけを保存する。
 * ここでは旧URLから画像をダウンロードして R2 に入れ直し、
 * 「旧URL -> 新キー」の対応表を出力する。import-legacy.ts がそれを読む。
 *
 * 旧URLは https://imagedelivery.net/<account-hash>/<uuid>/public という
 * 公開URLなので、認証情報は要らない (ローテーション済みのAPIトークンも不要)。
 *
 * 使い方 (apps/server で):
 *   pnpm exec tsx scripts/migrate-images.ts            # ローカルR2へ
 *   pnpm exec tsx scripts/migrate-images.ts --remote   # 本番R2へ
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { nanoid } from "nanoid";

const JSONS = resolve("../../jsons");
const OUTPUT = resolve("drizzle/seed/image-keys.json");
const WORK = resolve(".migrate-images-tmp");
const BUCKET = "hoseilink-r2";

const remote = process.argv.includes("--remote");

type PostImage = { id: string; url: string; postId: string };
type User = { id: string; avatarURL: string | null };
type Post = { id: string };

const readJson = <T>(name: string): T[] =>
  JSON.parse(readFileSync(resolve(JSONS, name), "utf8")) as T[];

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** 移行対象。旧URLと、新しいキーの置き場所 (posts/ か avatars/<userId>/) */
type Target = { url: string; prefix: string };

const targets: Target[] = [];

// --- 投稿画像。対応する投稿が存在するものだけ (孤児34件は取り込まない方針) ---
const postIds = new Set(readJson<Post>("post.json").map((row) => row.id));
const postImages = readJson<PostImage>("postImage.json");
const livePostImages = postImages.filter((image) => postIds.has(image.postId));

for (const image of livePostImages) {
  targets.push({ url: image.url, prefix: "posts" });
}

// --- アバター ---
const users = readJson<User>("user.json");
for (const user of users) {
  if (user.avatarURL) {
    targets.push({ url: user.avatarURL, prefix: `avatars/${user.id}` });
  }
}

console.log(`投稿画像   : ${postImages.length} 件中 ${livePostImages.length} 件が有効`);
console.log(`アバター   : ${targets.length - livePostImages.length} 件`);
console.log(`移行対象   : ${targets.length} 件`);
console.log(`投入先     : ${remote ? "本番 R2" : "ローカル R2"}`);
console.log("");

mkdirSync(WORK, { recursive: true });

/**
 * 既に採番済みの対応表。ローカルR2と本番R2で同じキーを使うために読み込む。
 * このスクリプトは何度流しても同じキーになる (冪等)。
 */
const existingKeys: Record<string, string> = existsSync(OUTPUT)
  ? (JSON.parse(readFileSync(OUTPUT, "utf8")) as Record<string, string>)
  : {};

/** 旧URL -> R2 のキー */
const keyByUrl: Record<string, string> = {};
const failures: { url: string; reason: string }[] = [];

for (const [index, target] of targets.entries()) {
  const label = `[${index + 1}/${targets.length}]`;

  try {
    const res = await fetch(target.url);
    if (!res.ok) {
      failures.push({ url: target.url, reason: `HTTP ${res.status}` });
      console.log(`${label} 取得失敗 (${res.status}) ${target.url}`);
      continue;
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const extension = EXTENSION_BY_MIME[contentType];
    if (!extension) {
      failures.push({ url: target.url, reason: `未対応の形式: ${contentType}` });
      console.log(`${label} 未対応の形式 (${contentType}) ${target.url}`);
      continue;
    }

    // 既に採番済みならそのキーを使い回す。
    // 実行のたびに採番し直すと、ローカルR2と本番R2で別々のキーになり、
    // 対応表がどちらか一方しか指せなくなってしまう。
    const key = existingKeys[target.url] ?? `${target.prefix}/${nanoid()}.${extension}`;
    const file = resolve(WORK, key.replace(/\//g, "_"));
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));

    execFileSync(
      "pnpm",
      [
        "exec",
        "wrangler",
        "r2",
        "object",
        "put",
        `${BUCKET}/${key}`,
        "--file",
        file,
        "--content-type",
        contentType,
        remote ? "--remote" : "--local",
      ],
      { stdio: "pipe", shell: process.platform === "win32" },
    );

    keyByUrl[target.url] = key;
    console.log(`${label} ${key}`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    failures.push({ url: target.url, reason });
    console.log(`${label} 失敗: ${reason}`);
  }
}

rmSync(WORK, { recursive: true, force: true });

// 既に対応表があれば統合する (ローカル -> 本番 と2回流しても失われないように)
const merged = existsSync(OUTPUT)
  ? { ...(JSON.parse(readFileSync(OUTPUT, "utf8")) as Record<string, string>), ...keyByUrl }
  : keyByUrl;

mkdirSync(resolve("drizzle/seed"), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(merged, null, 2) + "\n", "utf8");

console.log("");
console.log(`成功 : ${Object.keys(keyByUrl).length} / ${targets.length}`);
console.log(`対応表: ${OUTPUT}`);

if (failures.length > 0) {
  console.log("");
  console.log("失敗した画像:");
  for (const failure of failures) console.log(`  ${failure.reason} : ${failure.url}`);
  console.log("");
  console.log("※ 失敗した画像は import-legacy.ts 側で「画像なし」として扱われる");
}
