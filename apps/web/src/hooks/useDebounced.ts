import { useEffect, useState } from "react";

/**
 * 値の変化を遅延させて返す。
 *
 * 検索フォームで「入力のたびに何かする」処理をキー入力のたびに走らせないために使う。
 * 特に入力値を URL や API 呼び出しへ即座に反映すると、
 * 日本語入力(IME)の変換中に再レンダリングが挟まって未確定文字が消えることがある。
 */
export const useDebounced = <T,>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
