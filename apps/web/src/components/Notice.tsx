import { CircleAlert, CircleCheck, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type NoticeProps = {
  variant?: "info" | "done" | "error";
  children: ReactNode;
  className?: string;
};

/**
 * 画面内のお知らせ。
 * 完了は青 (trust) + check、エラーは danger + alert + 「エラー：」。
 * 赤と緑で出し分けない。
 */
export const Notice = ({ variant = "info", children, className }: NoticeProps) => {
  const Icon = variant === "error" ? CircleAlert : variant === "done" ? CircleCheck : Info;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg px-4 py-3 text-sm leading-[22px]",
        variant === "error"
          ? "bg-danger-tint text-danger-strong"
          : "bg-trust-tint text-foreground",
        className,
      )}
    >
      <Icon
        className={cn("mt-px size-5 shrink-0", variant !== "error" && "text-trust-strong")}
        aria-hidden
      />
      <p>
        {variant === "error" && "エラー："}
        {children}
      </p>
    </div>
  );
};

type EmptyStateProps = {
  icon: LucideIcon;
  children: ReactNode;
  /** 次にできることを1つだけ (主ボタンは1つまで) */
  action?: ReactNode;
};

/** リストが空のとき。責める言い方を避け、次にできることを書く */
export const EmptyState = ({ icon: Icon, children, action }: EmptyStateProps) => (
  <div className="grid justify-items-center gap-3 px-4 py-8 text-center">
    <span className="bg-brand-tint text-brand-strong grid size-16 place-items-center rounded-full">
      <Icon className="size-7" aria-hidden />
    </span>
    <p className="text-muted-foreground max-w-sm text-sm leading-[22px]">{children}</p>
    {action}
  </div>
);
