import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/Notice";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClass,
  useClassMessages,
  useDeleteClassMessage,
  useMarkClassViewed,
  useSendClassMessage,
} from "@/hooks/useClasses";
import { useProfile } from "@/hooks/useProfile";
import { displayName, timeOfDay } from "@/lib/format";

/**
 * 授業ごとのチャット。旧 app/class/[id]/chat + ClassChatBox.tsx の置き換え。
 * 同じ授業を登録している人同士が交流できる、このサービスの中心機能。
 */
export const ClassChat = () => {
  const { id = "" } = useParams();
  const { data: klass } = useClass(id);
  const { data, isPending } = useClassMessages(id);
  const { data: me } = useProfile();
  const sendMessage = useSendClassMessage(id);
  const deleteMessage = useDeleteClassMessage(id);
  const markViewed = useMarkClassViewed();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages ?? [];

  // 開いた時点で既読にする (時間割の未読バッジが下がる)
  useEffect(() => {
    if (id) markViewed.mutate(id);
    // 授業が変わったときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (text.trim() === "") return;

    sendMessage.mutate(text.trim(), {
      onSuccess: () => setText(""),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader back={`/class/${id}`} title={klass?.class.title ?? "授業チャット"} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
          {isPending ? (
            <>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </>
          ) : messages.length === 0 ? (
            <EmptyState icon={MessagesSquare}>
              同じ授業を登録している人と話せる場所です。教科書や課題のことを聞いてみましょう。
            </EmptyState>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="bg-card flex items-start gap-3 rounded-lg border p-3 shadow-card"
              >
                <Link to={`/user/${message.userId}`} tabIndex={-1} aria-hidden>
                  <UserAvatar
                    name={message.author.name}
                    avatarKey={message.author.avatarKey}
                    className="size-8"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/user/${message.userId}`}
                      className="truncate text-sm leading-5 font-bold hover:underline"
                    >
                      {displayName(message.author.name)}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {timeOfDay(message.createdAt)}
                    </span>
                    {message.userId === me?.profile.id && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-danger -my-1 ml-auto"
                        onClick={() =>
                          deleteMessage.mutate(message.id, {
                            onError: (e) => toast.error(e.message),
                          })
                        }
                      >
                        <Trash2 />
                        <span className="sr-only">削除</span>
                      </Button>
                    )}
                  </div>
                  <p className="break-words whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        className="bg-card border-t pb-[env(safe-area-inset-bottom)]"
        onSubmit={submit}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Input
            aria-label="メッセージ"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="メッセージを入力"
            maxLength={10000}
            className="bg-muted rounded-full"
          />
          <Button type="submit" size="icon" disabled={sendMessage.isPending}>
            <Send />
            <span className="sr-only">送信</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
