import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState, Notice } from "@/components/Notice";
import { SetupPrompt } from "@/components/SetupPrompt";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Department,
  useDeleteDepartmentMessage,
  useDepartmentMessages,
  useSendDepartmentMessage,
} from "@/hooks/useDepartments";
import { useProfile } from "@/hooks/useProfile";
import { useSetupGuard } from "@/hooks/useSetupGuard";
import { displayName, timeOfDay } from "@/lib/format";
import { departmentsStrict } from "server/constants";

const isDepartment = (value: string): value is Department =>
  (departmentsStrict as readonly string[]).includes(value);

/**
 * 学部ひろば。授業チャット (ClassChat) の学部版。
 *
 * 授業単位だと同じ授業の人がほとんどいないので、まずは学部単位で
 * 「開けば誰かがいる」場所を作る。読むのは誰でも、書けるのは自分の学部だけ。
 */
export const DepartmentChat = () => {
  const { department = "" } = useParams();

  if (!isDepartment(department)) {
    return <Navigate to="/timeline" replace />;
  }

  return <DepartmentChatBody department={department} />;
};

const DepartmentChatBody = ({ department }: { department: Department }) => {
  const { data, isPending } = useDepartmentMessages(department);
  const { data: me } = useProfile();
  const sendMessage = useSendDepartmentMessage(department);
  const deleteMessage = useDeleteDepartmentMessage(department);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { needsSetup } = useSetupGuard();

  const messages = data?.messages ?? [];
  const isMine = me?.profile.department === department;

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
      <AppHeader back="/timeline" title={`${department}ひろば`} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
          {isPending ? (
            <>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </>
          ) : messages.length === 0 ? (
            <EmptyState icon={MessagesSquare}>
              {department}の人なら誰でも話せる場所です。履修の相談や試験の情報を書き込んでみましょう。
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

      <div className="bg-card border-t pb-[env(safe-area-inset-bottom)]">
        {needsSetup ? (
          <div className="mx-auto max-w-2xl px-4 py-3">
            <SetupPrompt action="ひろばへの書き込み" />
          </div>
        ) : !isMine ? (
          <div className="mx-auto max-w-2xl px-4 py-3">
            <Notice>書き込めるのは自分の学部のひろばだけです。</Notice>
          </div>
        ) : (
          <form
            className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3"
            onSubmit={submit}
          >
            <Input
              aria-label="メッセージ"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`${department}のみんなに書き込む`}
              maxLength={10000}
              className="bg-muted rounded-full"
            />
            <Button type="submit" size="icon" disabled={sendMessage.isPending}>
              <Send />
              <span className="sr-only">送信</span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
