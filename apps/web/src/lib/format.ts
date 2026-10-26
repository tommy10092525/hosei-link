import { formatDistanceToNow, format, isThisYear } from "date-fns";
import { ja } from "date-fns/locale";

import { periods, youbiList } from "server/constants";

/**
 * R2 のオブジェクトキーを配信 URL に変換する。
 * DB にはキーだけを保存しているので、表示側は必ずここを通す。
 * これで将来 R2 のカスタムドメイン配信に切り替えてもここ1箇所の変更で済む。
 */
export const imageUrl = (key: string): string => `/api/images/${key}`;

/** 相対時刻 (例: 3分前)。1日以上前は日付表示にする */
export const timeAgo = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  const elapsed = Date.now() - date.getTime();

  if (elapsed < 24 * 60 * 60 * 1000) {
    return formatDistanceToNow(date, { addSuffix: true, locale: ja });
  }
  return format(date, isThisYear(date) ? "M月d日" : "yyyy年M月d日", { locale: ja });
};

/** チャットの吹き出しに出す時刻 */
export const timeOfDay = (value: string | Date): string =>
  format(typeof value === "string" ? new Date(value) : value, "H:mm");

/** 名前が空のときのフォールバック (初回セットアップ前のユーザーなど) */
export const displayName = (name: string | null | undefined): string =>
  name && name.trim() !== "" ? name : "名前未設定";

/** アバター用のイニシャル */
export const initial = (name: string | null | undefined): string =>
  displayName(name).slice(0, 1);

/* ------------------------------------------------------------------ *
 * 授業のコマ
 * ------------------------------------------------------------------ */

export type ClassSlot = { youbi: string; time: number };

/**
 * そのコマが時間割グリッド (月〜土 x 1〜7限) に置けるか。
 *
 * シラバスの元データには曜日・時限を持たない授業が1,677件あり、
 *   集中講義              -> youbi="other", time=-1
 *   曜日が取得できなかった -> youbi="none",  time=0
 * として入っている。これらをそのまま描画すると "other-1限" のような
 * 表示になってしまうので、必ずこの判定を通すこと。
 */
export const isScheduledSlot = (slot: ClassSlot): boolean =>
  (youbiList as readonly string[]).includes(slot.youbi) &&
  (periods as readonly number[]).includes(slot.time);

/** バッジなどに出すコマの表記 */
export const slotLabel = (slot: ClassSlot): string => {
  if (isScheduledSlot(slot)) return `${slot.youbi}${slot.time}`;
  return slot.youbi === "other" ? "集中・その他" : "日程未定";
};
