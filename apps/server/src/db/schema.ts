import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * 日時カラムの共通定義。
 * SQLite には日時型がないので epoch ミリ秒の INTEGER として保持する。
 * ミリ秒精度なのは、チャットが createdAt の昇順で並ぶため
 * 秒精度だと同一秒内で順序が壊れるから。
 */
const timestamp = () => integer({ mode: "timestamp_ms" });

const createdAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date());

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => nanoid());

/* ------------------------------------------------------------------ *
 * better-auth が管理するテーブル
 *
 * better-auth の drizzle adapter は「スキーマオブジェクトのフィールド名」で
 * カラムを引くため、キーは camelCase のままにしておく必要がある。
 * アプリ固有のユーザー属性は別テーブルに切らず、user の additionalFields として
 * ここに同居させる（実装を最小限にするため）。
 * ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: "boolean" }).notNull().default(false),
  image: text(),
  createdAt: createdAt(),
  updatedAt: createdAt(),

  // --- ここから additionalFields (アプリ固有) ---
  department: text(),
  major: text(),
  /** 公開アカウントかどうか。false なら投稿はフォロワーにしか見えない */
  public: integer({ mode: "boolean" }).notNull().default(false),
  bio: text(),
  /** R2 のオブジェクトキー。URL ではなくキーだけを持ち、配信方法を差し替え可能にする */
  avatarKey: text(),
  /** 時間割ページを最後に開いた時刻。授業チャットの未読バッジ算出に使う */
  lastScheduleViewAt: timestamp(),
});

export const session = sqliteTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessionUserIdIdx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("accountUserIdIdx").on(t.userId)],
);

/** magic link のトークンなど、有効期限付きの一時的な値 */
export const verification = sqliteTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("verificationIdentifierIdx").on(t.identifier)],
);

/* ------------------------------------------------------------------ *
 * 投稿まわり
 * ------------------------------------------------------------------ */

export const post = sqliteTable(
  "post",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text(),
    createdAt: createdAt(),
    /**
     * 返信先の投稿。自己参照なので references() だと型が循環する。
     * 下の foreignKey() で定義し、親を消したら返信も消えるようにする。
     */
    parentPostId: text(),
  },
  (t) => [
    foreignKey({
      columns: [t.parentPostId],
      foreignColumns: [t.id],
      name: "postParentFk",
    }).onDelete("cascade"),
    index("postUserIdIdx").on(t.userId),
    index("postCreatedAtIdx").on(t.createdAt),
    index("postParentIdx").on(t.parentPostId),
  ],
);

export const postImage = sqliteTable(
  "postImage",
  {
    id: id(),
    /** R2 のオブジェクトキー (例: posts/xxxx.jpg)。URL は保存しない */
    key: text().notNull(),
    postId: text()
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
  },
  (t) => [index("postImagePostIdIdx").on(t.postId)],
);

export const reaction = sqliteTable(
  "reaction",
  {
    id: id(),
    postId: text()
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text().notNull().default("like"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reactionPostIdIdx").on(t.postId),
    index("reactionUserIdIdx").on(t.userId),
    // 1ユーザー1投稿につき1リアクションを DB 側で保証する。
    // 旧実装は SELECT してから INSERT する競合しうる形だった。
    uniqueIndex("reactionPostUserUniq").on(t.postId, t.userId),
  ],
);

export const report = sqliteTable(
  "report",
  {
    id: id(),
    postId: text()
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text(),
    createdAt: createdAt(),
  },
  (t) => [index("reportPostIdIdx").on(t.postId)],
);

/* ------------------------------------------------------------------ *
 * DM
 * ------------------------------------------------------------------ */

export const message = sqliteTable(
  "message",
  {
    id: id(),
    fromUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text(),
    createdAt: createdAt(),
    isRead: integer({ mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("messagePairIdx").on(t.fromUserId, t.toUserId),
    /** 未読件数の集計 (toUserId + isRead) 用 */
    index("messageUnreadIdx").on(t.toUserId, t.isRead),
  ],
);

export const messageImage = sqliteTable(
  "messageImage",
  {
    id: id(),
    key: text().notNull(),
    messageId: text()
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
  },
  (t) => [index("messageImageMessageIdIdx").on(t.messageId)],
);

/* ------------------------------------------------------------------ *
 * 人間関係
 * ------------------------------------------------------------------ */

/**
 * followingId が followedId をフォローしている。
 * 命名は旧スキーマから引き継いでいるが直感に反するので注意:
 *   followingId = フォローする側 / followedId = フォローされる側
 */
export const follow = sqliteTable(
  "follow",
  {
    id: id(),
    followedId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("followFollowedIdx").on(t.followedId),
    index("followFollowingIdx").on(t.followingId),
    uniqueIndex("followPairUniq").on(t.followedId, t.followingId),
  ],
);

export const block = sqliteTable(
  "block",
  {
    id: id(),
    blocker: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blocked: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("blockBlockerIdx").on(t.blocker),
    uniqueIndex("blockPairUniq").on(t.blocker, t.blocked),
  ],
);

/* ------------------------------------------------------------------ *
 * 授業
 * ------------------------------------------------------------------ */

/**
 * シラバスから収集した授業マスタ。
 * id はシラバスの no_id をそのまま使う (URL /class/:id の体系を旧実装から維持するため)。
 *
 * 旧実装ではこのテーブルは実質未使用で、5.8MB の JSON をクライアントバンドルに
 * 同梱して全件フィルタしていた。新実装ではここを SQL で検索する。
 */
export const classes = sqliteTable(
  "class",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    code: text().notNull(),
    url: text().notNull(),
    place: text().notNull(),
    teacher: text().notNull(),
    gakubu: text().notNull(),
    /** シラバス上の元の表示文字列。全スロットを含む (例: "月1/Mon.1,木3/Thu.3") */
    timeInnerHTML: text().notNull(),
    nendo: integer().notNull(),
    online: integer({ mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("classGakubuIdx").on(t.gakubu),
    index("classTitleIdx").on(t.title),
    index("classTeacherIdx").on(t.teacher),
  ],
);

/**
 * 授業の開講コマ。
 *
 * 週に複数コマある授業 (月1 と 木3 など) は、シラバスの元データでも
 * 同じ no_id のまま行が分かれている。素直に取り込むと id が重複して
 * 主キーにできず、時間割にも片方のコマしか出せない。
 * そこでコマだけを別テーブルに正規化する。1授業あたり最大4コマ。
 */
export const classSlot = sqliteTable(
  "classSlot",
  {
    id: id(),
    classId: text()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    /** 曜日 (例: "月") */
    youbi: text().notNull(),
    /** 時限 */
    time: integer().notNull(),
  },
  (t) => [
    index("classSlotClassIdIdx").on(t.classId),
    index("classSlotSlotIdx").on(t.youbi, t.time),
    uniqueIndex("classSlotUniq").on(t.classId, t.youbi, t.time),
  ],
);

/** 履修登録。同じ授業を登録したユーザー同士が交流できるようにするための紐付け */
export const register = sqliteTable(
  "register",
  {
    id: id(),
    classId: text()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    /** その授業のチャットを最後に開いた時刻。未読バッジ算出に使う */
    lastViewedAt: timestamp(),
  },
  (t) => [
    index("registerClassIdIdx").on(t.classId),
    index("registerUserIdIdx").on(t.userId),
    uniqueIndex("registerPairUniq").on(t.classId, t.userId),
  ],
);

export const classMessage = sqliteTable(
  "classMessage",
  {
    id: id(),
    classId: text()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    text: text().notNull(),
  },
  (t) => [index("classMessageClassIdIdx").on(t.classId, t.createdAt)],
);

export const classReview = sqliteTable(
  "classReview",
  {
    id: id(),
    classId: text()
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    text: text().notNull(),
    rating: integer().notNull(),
  },
  (t) => [
    index("classReviewClassIdIdx").on(t.classId),
    // 1人1授業につき1レビュー。旧実装はアプリ側でしか担保していなかった
    uniqueIndex("classReviewPairUniq").on(t.classId, t.userId),
  ],
);

/* ------------------------------------------------------------------ *
 * その他
 * ------------------------------------------------------------------ */

export const contact = sqliteTable("contact", {
  id: id(),
  title: text().notNull(),
  content: text().notNull(),
  createdAt: createdAt(),
});
