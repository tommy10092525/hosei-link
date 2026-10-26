/**
 * サーバとクライアントの両方から参照する定数。
 *
 * このファイルはサーバ専用の import を一切持たないので、
 * apps/web からも `import { departments } from "server/constants"` で安全に読める
 * (package.json の exports に "./constants" を生やしてある)。
 * 学部リストを両側で二重管理しないためにここに置いている。
 */

export const projectName = "HoseiLink";

/** 大学のメールアドレス。これ以外は原則として登録できない */
export const universityEmailDomain = "stu.hosei.ac.jp";

/** 大学ドメイン以外で例外的に許可するアドレス (運営用) */
export const allowedEmails = ["hosei.codemates@gmail.com", "tommyxla777@gmail.com"];

/** 授業検索のフィルタなど、表示用の全学部・全科目区分 */
export const departments = [
  "法学部",
  "文学部",
  "経済学部",
  "社会学部",
  "経営学部",
  "国際文化学部",
  "人間環境学部",
  "現代福祉学部",
  "情報科学部",
  "キャリアデザイン学部",
  "デザイン工学部",
  "理工学部",
  "生命科学部",
  "グローバル教養学部",
  "スポーツ健康学部",
  "IGESS",
  "GBP",
  "SCOPE",
  "通信教育部（通信学習）",
  "通信教育部（スクーリング）",
  "全学PF_社会連携教育科目",
  "全学PF_キャリア教育科目",
  "全学PF_データサイエンス科目",
  "全学PF_海外フィールドスクール",
  "リベラルアーツ",
  "小金井共通",
  "日本語教育センター",
  "SSI",
  "教職・資格（市ヶ谷）",
  "教職・資格（多摩）",
  "教職・資格（小金井）",
  "ERP",
  "ESOP",
  "現地研修プログラム",
] as const;

/**
 * ユーザーのプロフィールに設定できる学部。
 * 「小金井共通」「教職・資格」などは学部ではないので departments より狭い。
 */
export const departmentsStrict = [
  "経済学部",
  "社会学部",
  "現代福祉学部",
  "スポーツ健康学部",
  "法学部",
  "文学部",
  "経営学部",
  "国際文化学部",
  "人間環境学部",
  "キャリアデザイン学部",
  "グローバル教養学部",
  "情報科学部",
  "デザイン工学部",
  "理工学部",
  "生命科学部",
  "通信教育部（通信学習）",
  "通信教育部（スクーリング）",
] as const;

/** 時間割の曜日。授業検索と時間割グリッドの列に対応する */
export const youbiList = ["月", "火", "水", "木", "金", "土"] as const;

/** 時限。時間割グリッドの行に対応する */
export const periods = [1, 2, 3, 4, 5, 6, 7] as const;

/** そのメールアドレスが登録を許可されているか */
export const isAllowedEmail = (email: string): boolean => {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith(`@${universityEmailDomain}`) ||
    allowedEmails.includes(normalized)
  );
};
