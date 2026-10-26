import { MessageCircle, Send, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/Notice";
import { SetupPrompt } from "@/components/SetupPrompt";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSendMessage, useThread } from "@/hooks/useMessages";
import { useProfile } from "@/hooks/useProfile";
import { useSetupGuard } from "@/hooks/useSetupGuard";
import { useUser } from "@/hooks/useSocial";
import { displayName, timeOfDay } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 1対1のメッセージ。旧 app/chat/[id]/page.tsx + ChatBox.tsx の置き換え。
 * 差分ポーリングは useThread の refetchInterval が担う。
 */
export const Chat = () => {
  const { id = "" } = useParams();
  const { data: me } = useProfile();
  const { data: peer } = useUser(id);
  const { data, isPending } = useThread(id);
  const sendMessage = useSendMessage(id);
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { needsSetup } = useSetupGuard();

  const messages = data?.messages ?? [];

  // 新着が来たら最下部に送る
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (content.trim() === "") return;

    sendMessage.mutate(content.trim(), {
      onSuccess: () => setContent(""),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        back="/chat"
        title={
          peer ? (
            <span className="flex items-center gap-2">
              <UserAvatar
                name={peer.user.name}
                avatarKey={peer.user.avatarKey}
                className="size-8"
              />
              <span className="truncate">{displayName(peer.user.name)}</span>
            </span>
          ) : (
            ""
          )
        }
        actions={
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/user/${id}`}>
              <User />
              <span className="sr-only">プロフィールを見る</span>
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-2 px-4 py-4">
          {isPending ? (
            <>
              <Skeleton className="h-10 w-2/3 rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
            </>
          ) : messages.length === 0 ? (
            <EmptyState icon={MessageCircle}>
              最初のメッセージを送ってみましょう。
            </EmptyState>
          ) : (
            messages.map((message) => {
              const mine = message.fromUserId === me?.profile.id;
              return (
                <div
                  key={message.id}
                  className={cn("flex items-end gap-2", mine && "flex-row-reverse")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] px-4 py-2 break-words whitespace-pre-wrap",
                      mine
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                        : "bg-card rounded-2xl rounded-bl-sm border",
                    )}
                  >
                    {message.content}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {timeOfDay(message.createdAt)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {needsSetup ? (
        <div className="bg-card border-t pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <SetupPrompt action="メッセージの送信" />
          </div>
        </div>
      ) : (
        <form
          className="bg-card border-t pb-[env(safe-area-inset-bottom)]"
          onSubmit={submit}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
            <Input
              aria-label="メッセージ"
              value={content}
              onChange={(event) => setContent(event.target.value)}
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
      )}
    </div>
  );
};
