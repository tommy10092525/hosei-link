import { and, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { projectName } from "./constants";
import { getDb } from "./db";
import { classMessage, departmentMessage, post, register, user } from "./db/schema";
import type { Bindings } from "./env";
import { sendMail } from "./mail";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** メールに引用するひろばの書き込みの数 */
const QUOTE_COUNT = 3;
const QUOTE_LENGTH = 60;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const truncate = (value: string) => {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > QUOTE_LENGTH ? `${oneLine.slice(0, QUOTE_LENGTH)}…` : oneLine;
};

type Digest = {
  name: string;
  department: string;
  departmentCount: number;
  quotes: string[];
  classCount: number;
  postCount: number;
};

const buildMail = (env: Bindings, digest: Digest) => {
  const openUrl = `${env.BASE_URL}/#/hiroba/${encodeURIComponent(digest.department)}`;
  const settingsUrl = `${env.BASE_URL}/#/profile`;

  const lines: string[] = [];
  if (digest.departmentCount > 0) {
    lines.push(`${digest.department}ひろば：新しい書き込み ${digest.departmentCount}件`);
  }
  if (digest.classCount > 0) {
    lines.push(`履修中の授業のチャット：新しいメッセージ ${digest.classCount}件`);
  }
  if (digest.postCount > 0) {
    lines.push(`タイムライン：新しい投稿 ${digest.postCount}件`);
  }

  const subject =
    digest.departmentCount > 0
      ? `今週の${digest.department}ひろば：新しい書き込み ${digest.departmentCount}件`
      : `今週の${projectName}：新着があります`;

  const text = [
    `${digest.name}さん、こんにちは。${projectName} の先週の新着をお知らせします。`,
    "",
    ...lines.map((line) => `・${line}`),
    ...(digest.quotes.length > 0
      ? ["", "ひろばの最近の書き込み:", ...digest.quotes.map((q) => `「${q}」`)]
      : []),
    "",
    `開く: ${openUrl}`,
    "",
    `このメールが不要な場合は、プロフィール編集から停止できます: ${settingsUrl}`,
  ].join("\n");

  const html = `
<p>${escapeHtml(digest.name)}さん、こんにちは。${projectName} の先週の新着をお知らせします。</p>
<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
${
  digest.quotes.length > 0
    ? `<p>ひろばの最近の書き込み:</p><ul>${digest.quotes
        .map((q) => `<li>「${escapeHtml(q)}」</li>`)
        .join("")}</ul>`
    : ""
}
<p><a href="${escapeHtml(openUrl)}">${projectName} を開く</a></p>
<p style="color:#888;font-size:12px">このメールが不要な場合は、<a href="${escapeHtml(
    settingsUrl,
  )}">プロフィール編集</a>から停止できます。</p>`;

  return { subject, text, html };
};

/**
 * 週1回の新着まとめメール。wrangler.jsonc の cron から呼ばれる。
 *
 * 登録しても使い続けてもらえていないので、学部ひろば・履修中の授業・タイムラインに
 * 新着があった週だけ「また開く理由」を届ける。何もない週は送らない
 * (空のメールは配信停止を招くだけなので)。
 *
 * D1 のクエリ数制限があるので、ユーザーごとにクエリを投げず、
 * 集計はそれぞれ1本 (GROUP BY) にまとめてからメモリ上で組み立てる。
 */
export const sendWeeklyDigests = async (env: Bindings, now = new Date()) => {
  const db = getDb(env);
  const since = new Date(now.getTime() - WEEK_MS);

  // セットアップ済みで、配信を止めていない人
  const recipients = await db
    .select({ id: user.id, name: user.name, email: user.email, department: user.department })
    .from(user)
    .where(
      and(eq(user.weeklyDigest, true), isNotNull(user.department), ne(user.name, "")),
    );

  // 学部ごとの新着数
  const departmentCounts = await db
    .select({
      department: departmentMessage.department,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(departmentMessage)
    .where(gt(departmentMessage.createdAt, since))
    .groupBy(departmentMessage.department);

  // 学部ごとの最新の書き込み (引用用)。件数は少ないので新しい順に取って振り分ける
  const recentDepartmentMessages = await db
    .select({ department: departmentMessage.department, text: departmentMessage.text })
    .from(departmentMessage)
    .where(gt(departmentMessage.createdAt, since))
    .orderBy(desc(departmentMessage.createdAt))
    .limit(500);

  // 履修中の授業に、自分以外が書き込んだ新着数 (ユーザーごと)
  const classCounts = await db
    .select({
      userId: register.userId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(register)
    .innerJoin(
      classMessage,
      and(
        eq(classMessage.classId, register.classId),
        gt(classMessage.createdAt, since),
        ne(classMessage.userId, register.userId),
      ),
    )
    .groupBy(register.userId);

  // タイムラインに出る公開アカウントの新しい投稿 (返信は除く)
  const [posts] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(post)
    .innerJoin(user, eq(user.id, post.userId))
    .where(and(gt(post.createdAt, since), eq(user.public, true), isNull(post.parentPostId)));

  const departmentCountMap = new Map(departmentCounts.map((row) => [row.department, row.count]));
  const classCountMap = new Map(classCounts.map((row) => [row.userId, row.count]));
  const quoteMap = new Map<string, string[]>();
  for (const row of recentDepartmentMessages) {
    const list = quoteMap.get(row.department) ?? [];
    if (list.length < QUOTE_COUNT) list.push(truncate(row.text));
    quoteMap.set(row.department, list);
  }

  const isDevelopment = env.APP_ENV !== "production";
  let sent = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const department = recipient.department as string;
    const digest: Digest = {
      name: recipient.name,
      department,
      departmentCount: departmentCountMap.get(department) ?? 0,
      quotes: quoteMap.get(department) ?? [],
      classCount: classCountMap.get(recipient.id) ?? 0,
      postCount: posts?.count ?? 0,
    };

    if (digest.departmentCount + digest.classCount + digest.postCount === 0) {
      skipped++;
      continue;
    }

    const mail = buildMail(env, digest);

    // magic link と同じく、開発中は既定で実送信せずログに出すだけ
    if (isDevelopment && env.DEV_SEND_EMAIL !== "true") {
      console.log(`[digest] (dev) to=${recipient.email} subject=${mail.subject}\n${mail.text}`);
      sent++;
      continue;
    }

    try {
      await sendMail(env, { to: recipient.email, ...mail });
      sent++;
    } catch (e) {
      // 1人の失敗で残りを止めない
      console.error(`[digest] failed to=${recipient.email}`, e);
    }
  }

  console.log(
    `[digest] mode=${env.APP_ENV} recipients=${recipients.length} sent=${sent} skipped=${skipped}`,
  );
};
