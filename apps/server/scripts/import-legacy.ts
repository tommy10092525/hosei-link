/**
 * 旧 Neon PostgreSQL のエクスポート (jsons/) から D1 用の SQL を生成する。
 *
 * scripts/seed-classes.ts と同じ方式で、SQL ファイルを吐いて
 * `wrangler d1 execute --file` で流す。
 *
 * 使い方 (apps/server で):
 *   pnpm exec tsx scripts/import-legacy.ts
 *   pnpm exec wrangler d1 execute hoseilink-d1 --local  --file drizzle/seed/legacy.sql
 *   pnpm exec wrangler d1 execute hoseilink-d1 --remote --file drizzle/seed/legacy.sql
 *
 * 授業マスタ (class / classSlot) は seed-classes.ts が入れたものを残す。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const JSONS = resolve("../../jsons");
const IMAGE_KEYS = resolve("drizzle/seed/image-keys.json");
const OUTPUT = resolve("drizzle/seed/legacy.sql");
const CHUNK = 200;

/* ------------------------------------------------------------------ *
 * 変換ユーティリティ
 * ------------------------------------------------------------------ */

/**
 * Postgres のダンプ形式 "2026-04-13 02:35:15.366009" を epoch ミリ秒にする。
 *
 * この形式は ISO8601 ではないので new Date() に直接渡すと V8 が
 * ローカル時刻として解釈し、JST 環境では9時間ずれる。
 * 明示的に "T" 区切り + "Z" に直し、小数部はミリ秒3桁に切り詰める。
 */
const toEpochMs = (value: string | null | undefined): number | null => {
  if (!value) return null;

  const normalized = value
    .trim()
    .replace(" ", "T")
    .replace(/\.(\d{1,6})$/, (_, fraction: string) => `.${fraction.padEnd(3, "0").slice(0, 3)}`);

  const ms = Date.parse(`${normalized}Z`);
  if (Number.isNaN(ms)) throw new Error(`日時を解釈できません: ${JSON.stringify(value)}`);
  return ms;
};

const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** SQL のリテラルにする。null は NULL、真偽値は 0/1 */
const lit = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(value);
  return quote(value);
};

const readJson = <T>(name: string): T[] =>
  JSON.parse(readFileSync(resolve(JSONS, name), "utf8")) as T[];

const chunked = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** 落とした行の記録。最後にまとめて報告する */
const dropped: { table: string; reason: string; count: number }[] = [];
const drop = (table: string, reason: string, count: number) => {
  if (count > 0) dropped.push({ table, reason, count });
};

/**
 * 新スキーマで新設した複合一意制約に合わせて重複を除く。
 * 旧 DB には制約がなかったので実データに重複がありうる。古いものを残す。
 */
const dedupe = <T,>(
  rows: T[],
  key: (row: T) => string,
  order: (row: T) => number,
): { kept: T[]; removed: number } => {
  const byKey = new Map<string, T>();
  for (const row of [...rows].sort((a, b) => order(a) - order(b))) {
    const k = key(row);
    if (!byKey.has(k)) byKey.set(k, row);
  }
  return { kept: [...byKey.values()], removed: rows.length - byKey.size };
};

/* ------------------------------------------------------------------ *
 * 入力
 * ------------------------------------------------------------------ */

type LegacyUser = {
  id: string;
  name: string | null;
  email: string;
  department: string | null;
  major: string | null;
  public: boolean;
  createAt: string; // 旧スキーマのタイポ (createdAt ではない)
  emailVerified: boolean;
  avatarURL: string | null;
  bio: string | null;
  lastScheduleViewAt: string | null;
};
type LegacyPost = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  parentPostId: string | null;
};
type LegacyPostImage = { id: string; url: string; postId: string };
type LegacyReaction = {
  id: string;
  postId: string;
  userId: string;
  type: string;
  createdAt: string;
};
type LegacyMessage = {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string | null;
  createdAt: string;
  isRead: boolean;
};
type LegacyFollow = {
  id: string;
  followedId: string;
  followingId: string;
  createdAt: string;
};
type LegacyBlock = { id: string; blocker: string; blocked: string };
type LegacyReport = { id: string; postId: string; userId: string; text: string };
type LegacyRegister = {
  id: string;
  classId: string;
  userId: string;
  createdAt: string;
  lastViewedAt: string | null;
};
type LegacyClassMessage = {
  id: string;
  classId: string;
  userId: string;
  createdAt: string;
  text: string;
};
type LegacyClassReview = {
  id: string;
  classId: string;
  userId: string;
  createdAt: string;
  text: string;
  rating: number;
};

const users = readJson<LegacyUser>("user.json");
const posts = readJson<LegacyPost>("post.json");
const postImages = readJson<LegacyPostImage>("postImage.json");
const reactions = readJson<LegacyReaction>("reaction.json");
const messages = readJson<LegacyMessage>("message.json");
const follows = readJson<LegacyFollow>("follow.json");
const blocks = readJson<LegacyBlock>("block.json");
const reports = readJson<LegacyReport>("report.json");
const registers = readJson<LegacyRegister>("register.json");
const classMessages = readJson<LegacyClassMessage>("classMessage.json");
const classReviews = readJson<LegacyClassReview>("classReview.json");

if (!existsSync(IMAGE_KEYS)) {
  console.error(
    `画像の対応表がありません: ${IMAGE_KEYS}\n` +
      "先に `pnpm exec tsx scripts/migrate-images.ts` を実行してください。",
  );
  process.exit(1);
}
const keyByUrl = JSON.parse(readFileSync(IMAGE_KEYS, "utf8")) as Record<string, string>;

/* ------------------------------------------------------------------ *
 * フィルタと整形
 * ------------------------------------------------------------------ */

const userIds = new Set(users.map((row) => row.id));
const postIds = new Set(posts.map((row) => row.id));

/** シラバスの授業IDは数値。nanoid のものは class にマップできない */
const isSyllabusId = (value: string) => /^\d+$/.test(value);

// --- 投稿画像: 対応する投稿があり、かつ R2 への移行が済んでいるものだけ ---
const orphanImages = postImages.filter((row) => !postIds.has(row.postId));
drop("postImage", "対応する投稿が存在しない", orphanImages.length);

const liveImages = postImages.filter((row) => postIds.has(row.postId));
const unmigratedImages = liveImages.filter((row) => !keyByUrl[row.url]);
drop("postImage", "R2 への移行に失敗", unmigratedImages.length);

const keptImages = liveImages.filter((row) => keyByUrl[row.url]);

// --- ブロック: 自己ブロックは取り込まない ---
// 取り込むとタイムラインの block 判定 (blocker=自分 かつ blocked=投稿者) に
// 自分自身が引っかかり、当人の投稿が自分のタイムラインから消えてしまう
const selfBlocks = blocks.filter((row) => row.blocker === row.blocked);
drop("block", "自己ブロック (取り込むと自分の投稿が見えなくなる)", selfBlocks.length);
const keptBlocks = blocks.filter(
  (row) => row.blocker !== row.blocked && userIds.has(row.blocker) && userIds.has(row.blocked),
);

// --- 通報: 対応する投稿があるものだけ ---
const orphanReports = reports.filter((row) => !postIds.has(row.postId));
drop("report", "対応する投稿が存在しない", orphanReports.length);
const keptReports = reports.filter((row) => postIds.has(row.postId));

// --- 授業に紐づくもの: シラバスIDのものだけ ---
const badReviewClass = classReviews.filter((row) => !isSyllabusId(row.classId));
drop("classReview", "授業ID がシラバス形式でない", badReviewClass.length);

const badMessageClass = classMessages.filter((row) => !isSyllabusId(row.classId));
drop("classMessage", "授業ID がシラバス形式でない", badMessageClass.length);

// --- 複合一意制約に合わせた重複除去 ---
const dedupedReactions = dedupe(
  reactions.filter((row) => postIds.has(row.postId) && userIds.has(row.userId)),
  (row) => `${row.postId} ${row.userId}`,
  (row) => toEpochMs(row.createdAt) ?? 0,
);
drop("reaction", "同一ユーザーの同一投稿への重複", dedupedReactions.removed);

const dedupedFollows = dedupe(
  follows.filter((row) => userIds.has(row.followedId) && userIds.has(row.followingId)),
  (row) => `${row.followedId} ${row.followingId}`,
  (row) => toEpochMs(row.createdAt) ?? 0,
);
drop("follow", "同一の組み合わせの重複", dedupedFollows.removed);

const dedupedBlocks = dedupe(
  keptBlocks,
  (row) => `${row.blocker} ${row.blocked}`,
  () => 0,
);
drop("block", "同一の組み合わせの重複", dedupedBlocks.removed);

const dedupedRegisters = dedupe(
  registers.filter((row) => isSyllabusId(row.classId) && userIds.has(row.userId)),
  (row) => `${row.classId} ${row.userId}`,
  (row) => toEpochMs(row.createdAt) ?? 0,
);
drop("register", "同一ユーザーの同一授業への重複", dedupedRegisters.removed);

const dedupedReviews = dedupe(
  classReviews.filter((row) => isSyllabusId(row.classId) && userIds.has(row.userId)),
  (row) => `${row.classId} ${row.userId}`,
  (row) => toEpochMs(row.createdAt) ?? 0,
);
drop("classReview", "同一ユーザーの同一授業への重複", dedupedReviews.removed);

const keptClassMessages = classMessages.filter(
  (row) => isSyllabusId(row.classId) && userIds.has(row.userId),
);

// block と report には旧テーブルに createdAt がない。
// 新スキーマは notNull なので、そのユーザーの登録時刻で埋める (無ければ最古の投稿時刻)
const createdAtByUser = new Map(users.map((row) => [row.id, toEpochMs(row.createAt) ?? 0]));
const fallbackTime = Math.min(...posts.map((row) => toEpochMs(row.createdAt) ?? 0));
const timeFor = (userId: string) => createdAtByUser.get(userId) ?? fallbackTime;

/* ------------------------------------------------------------------ *
 * SQL の組み立て
 * ------------------------------------------------------------------ */

const statements: string[] = [
  "-- scripts/import-legacy.ts が生成。直接編集しないこと",
  "-- 旧 Neon DB (jsons/) からの復元。class / classSlot は seed-classes.sql のものを残す",
  "",
  "-- 依存の深い側から消す",
  "DELETE FROM report;",
  "DELETE FROM block;",
  "DELETE FROM follow;",
  "DELETE FROM reaction;",
  "DELETE FROM postImage;",
  "DELETE FROM post;",
  "DELETE FROM messageImage;",
  "DELETE FROM message;",
  "DELETE FROM classReview;",
  "DELETE FROM classMessage;",
  "DELETE FROM register;",
  "DELETE FROM contact;",
  "DELETE FROM session;",
  "DELETE FROM account;",
  "DELETE FROM verification;",
  "DELETE FROM user;",
  "",
];

const insert = (table: string, columns: string[], rows: (string | number | null)[][]) => {
  if (rows.length === 0) return;

  for (const chunk of chunked(rows, CHUNK)) {
    const values = chunk.map((row) => `(${row.map(lit).join(",")})`).join(",\n");
    statements.push(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES\n${values};`,
    );
  }
};

// --- user ---
// password / verificationToken / loginTokenHash などは better-auth が肩代わりするので捨てる。
// name は新スキーマで notNull。null だった49人は空文字にすると needsSetup が立ち、
// 初回ログイン時にプロフィール設定へ誘導される (意図した挙動)
insert(
  "user",
  [
    "id",
    "name",
    "email",
    "emailVerified",
    "image",
    "createdAt",
    "updatedAt",
    "department",
    "major",
    "public",
    "bio",
    "avatarKey",
    "lastScheduleViewAt",
  ],
  users.map((row) => {
    const created = toEpochMs(row.createAt)!;
    return [
      row.id,
      row.name?.trim() ?? "",
      row.email,
      row.emailVerified ? 1 : 0,
      null,
      created,
      created,
      row.department?.trim() || null,
      row.major?.trim() || null,
      row.public ? 1 : 0,
      row.bio?.trim() || null,
      row.avatarURL ? (keyByUrl[row.avatarURL] ?? null) : null,
      toEpochMs(row.lastScheduleViewAt),
    ];
  }),
);

// --- post ---
insert(
  "post",
  ["id", "userId", "content", "createdAt", "parentPostId"],
  posts.map((row) => [
    row.id,
    row.userId,
    row.content,
    toEpochMs(row.createdAt)!,
    row.parentPostId,
  ]),
);

// --- postImage (url ではなく R2 のキーを入れる) ---
insert(
  "postImage",
  ["id", "key", "postId"],
  keptImages.map((row) => [row.id, keyByUrl[row.url]!, row.postId]),
);

// --- reaction ---
insert(
  "reaction",
  ["id", "postId", "userId", "type", "createdAt"],
  dedupedReactions.kept.map((row) => [
    row.id,
    row.postId,
    row.userId,
    row.type,
    toEpochMs(row.createdAt)!,
  ]),
);

// --- report (createdAt を補う) ---
insert(
  "report",
  ["id", "postId", "userId", "text", "createdAt"],
  keptReports.map((row) => [row.id, row.postId, row.userId, row.text, timeFor(row.userId)]),
);

// --- message ---
insert(
  "message",
  ["id", "fromUserId", "toUserId", "content", "createdAt", "isRead"],
  messages.map((row) => [
    row.id,
    row.fromUserId,
    row.toUserId,
    row.content,
    toEpochMs(row.createdAt)!,
    row.isRead ? 1 : 0,
  ]),
);

// --- follow ---
insert(
  "follow",
  ["id", "followedId", "followingId", "createdAt"],
  dedupedFollows.kept.map((row) => [
    row.id,
    row.followedId,
    row.followingId,
    toEpochMs(row.createdAt)!,
  ]),
);

// --- block (createdAt を補う) ---
insert(
  "block",
  ["id", "blocker", "blocked", "createdAt"],
  dedupedBlocks.kept.map((row) => [row.id, row.blocker, row.blocked, timeFor(row.blocker)]),
);

// --- register ---
insert(
  "register",
  ["id", "classId", "userId", "createdAt", "lastViewedAt"],
  dedupedRegisters.kept.map((row) => [
    row.id,
    row.classId,
    row.userId,
    toEpochMs(row.createdAt)!,
    toEpochMs(row.lastViewedAt),
  ]),
);

// --- classMessage ---
insert(
  "classMessage",
  ["id", "classId", "userId", "createdAt", "text"],
  keptClassMessages.map((row) => [
    row.id,
    row.classId,
    row.userId,
    toEpochMs(row.createdAt)!,
    row.text,
  ]),
);

// --- classReview ---
insert(
  "classReview",
  ["id", "classId", "userId", "createdAt", "text", "rating"],
  dedupedReviews.kept.map((row) => [
    row.id,
    row.classId,
    row.userId,
    toEpochMs(row.createdAt)!,
    row.text,
    row.rating,
  ]),
);

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, statements.join("\n") + "\n", "utf8");

/* ------------------------------------------------------------------ *
 * 報告
 * ------------------------------------------------------------------ */

const summary: [string, number, number][] = [
  ["user", users.length, users.length],
  ["post", posts.length, posts.length],
  ["postImage", postImages.length, keptImages.length],
  ["reaction", reactions.length, dedupedReactions.kept.length],
  ["message", messages.length, messages.length],
  ["follow", follows.length, dedupedFollows.kept.length],
  ["block", blocks.length, dedupedBlocks.kept.length],
  ["report", reports.length, keptReports.length],
  ["register", registers.length, dedupedRegisters.kept.length],
  ["classMessage", classMessages.length, keptClassMessages.length],
  ["classReview", classReviews.length, dedupedReviews.kept.length],
];

console.log("テーブル       元データ -> 取り込み");
for (const [table, from, to] of summary) {
  const mark = from === to ? " " : "*";
  console.log(`  ${mark} ${table.padEnd(14)} ${String(from).padStart(4)} -> ${String(to).padStart(4)}`);
}

if (dropped.length > 0) {
  console.log("");
  console.log("取り込まなかった行:");
  for (const item of dropped) {
    console.log(`  ${item.table.padEnd(14)} ${String(item.count).padStart(3)} 件 : ${item.reason}`);
  }
}

const oldest = Math.min(...posts.map((row) => toEpochMs(row.createdAt)!));
const newest = Math.max(...posts.map((row) => toEpochMs(row.createdAt)!));
console.log("");
console.log("投稿の日時範囲 (UTC。9時間ずれていないか確認すること):");
console.log(`  最古 ${new Date(oldest).toISOString()}`);
console.log(`  最新 ${new Date(newest).toISOString()}`);
console.log("");
console.log(`出力: ${OUTPUT}`);
