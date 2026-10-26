import { UserPen } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { type SetupState, useSetupGuard } from "@/hooks/useSetupGuard";
import { cn } from "@/lib/utils";

type Props = {
  /** 何ができるようになるか。「投稿」「メッセージの送信」など */
  action: string;
  className?: string;
};

/**
 * セットアップ前のユーザーに、入力欄の代わりに出す案内。
 * 入力してから弾くと書いた文章が消えるので、フォームごと差し替える。
 */
export const SetupPrompt = ({ action, className }: Props) => {
  const { from } = useSetupGuard();

  return (
    <div
      className={cn(
        "bg-trust-tint flex items-center gap-3 rounded-lg px-4 py-3 text-sm leading-[22px]",
        className,
      )}
    >
      <UserPen className="text-trust-strong size-5 shrink-0" aria-hidden />
      <p className="flex-1">名前と学部を設定すると、{action}ができるようになります。</p>
      <Button size="sm" asChild>
        <Link to="/setup" state={{ from } satisfies SetupState}>
          設定する
        </Link>
      </Button>
    </div>
  );
};
