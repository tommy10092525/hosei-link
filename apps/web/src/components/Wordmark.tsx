import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** brand (オレンジ) の面の上に置くときは両方 on-brand にする */
  onBrand?: boolean;
};

/**
 * 文字ロゴ。「Hosei」は ink、「Link」は brand-strong。
 * 見出しと同じ Noto Sans JP 900 で組む。
 */
export const Wordmark = ({ className, onBrand = false }: Props) => (
  <span
    className={cn(
      "text-xl leading-7 font-black tracking-[-0.01em]",
      onBrand ? "text-on-brand" : "text-foreground",
      className,
    )}
  >
    Hosei <span className={onBrand ? undefined : "text-brand-strong"}>Link</span>
  </span>
);
