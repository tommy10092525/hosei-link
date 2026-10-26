import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";

import icon from "../../icon.png";

type Props = {
  /** 省略するとホーム扱いで文字ロゴを出す */
  title?: ReactNode;
  /**
   * 戻るボタンの行き先。履歴があればブラウザバックし、
   * URL 直打ちなどで履歴が無いときだけここへ遷移する
   */
  back?: string;
  /** 右側の操作。アイコンボタン (Button size="icon") を2つまで */
  actions?: ReactNode;
};

/**
 * 画面上部のバー (高さ56px)。各ページが自分で置く。
 * 画面名が授業名や相手の名前のように動的に決まるため、レイアウト側では持たない。
 *
 * 主要な操作 (投稿など) はここに置かず、画面内の主ボタンか下部タブに置く。
 */
export const AppHeader = ({ title, back, actions }: Props) => {
  const navigate = useNavigate();

  const goBack = () => {
    // react-router は history.state.idx にこのセッション内での位置を持っている
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      void navigate(-1);
    } else if (back) {
      void navigate(back, { replace: true });
    }
  };

  return (
    <header className="bg-card sticky top-0 z-40 border-b">
      <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1 pr-1 pl-4">
        {back && (
          <Button variant="ghost" size="icon" className="-ml-3" onClick={goBack}>
            <ChevronLeft />
            <span className="sr-only">戻る</span>
          </Button>
        )}

        {title === undefined ? (
          <Link to="/timeline" className="flex flex-1 items-center gap-2">
            <img src={icon} alt="" className="size-8" />
            <Wordmark />
          </Link>
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-lg leading-[26px] font-bold">
            {title}
          </h1>
        )}

        {actions}
      </div>
    </header>
  );
};
