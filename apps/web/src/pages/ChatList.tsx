import { ChevronRight, MessageCircle, UserPlus } from "lucide-react";
import { Link } from "react-router";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/Notice";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnreadMessages } from "@/hooks/useMessages";
import { useRelations } from "@/hooks/useSocial";
import { displayName } from "@/lib/format";

/**
 * 「交流」タブの入口 (メッセージ一覧)。
 * 未読のある相手を上に出し、その下にフォロー関係のある人を並べる。
 */
export const ChatList = () => {
  const { data: unread } = useUnreadMessages();
  const { data: relations, isPending } = useRelations();

  const unreadBySender = new Map(
    (unread?.senders ?? []).map((sender) => [sender.senderId, sender.count]),
  );

  // フォロー中とフォロワーを結合して重複を除く
  const people = [...(relations?.following ?? []), ...(relations?.followers ?? [])];
  const unique = [...new Map(people.map((person) => [person.id, person])).values()];

  // 未読が多い順、次に名前順
  unique.sort((a, b) => {
    const diff = (unreadBySender.get(b.id) ?? 0) - (unreadBySender.get(a.id) ?? 0);
    return diff !== 0 ? diff : displayName(a.name).localeCompare(displayName(b.name), "ja");
  });

  return (
    <>
      <AppHeader title="メッセージ" />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Link
          to="/friends"
          className="bg-card hover:bg-accent flex min-h-14 items-center gap-3 rounded-lg border px-4 shadow-card transition-colors"
        >
          <span className="bg-brand-tint text-brand-strong grid size-10 place-items-center rounded-full">
            <UserPlus className="size-5" aria-hidden />
          </span>
          <span className="flex-1 font-bold">友達をさがす・フォロー一覧</span>
          <ChevronRight className="text-muted-foreground size-5" aria-hidden />
        </Link>

        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : unique.length === 0 ? (
          <EmptyState icon={MessageCircle}>
            フォローしている人やフォロワーと、ここからメッセージをやりとりできます。
          </EmptyState>
        ) : (
          <ul className="bg-card divide-y overflow-hidden rounded-lg border shadow-card">
            {unique.map((person) => {
              const count = unreadBySender.get(person.id) ?? 0;
              return (
                <li key={person.id}>
                  <Link
                    to={`/chat/${person.id}`}
                    className="hover:bg-accent flex items-center gap-3 px-4 py-3 transition-colors"
                  >
                    <UserAvatar name={person.name} avatarKey={person.avatarKey} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{displayName(person.name)}</p>
                      <p className="text-muted-foreground truncate text-sm leading-[22px]">
                        {person.department}
                        {person.major}
                      </p>
                    </div>
                    {count > 0 && (
                      <Badge>
                        {count}
                        <span className="sr-only">件の未読</span>
                      </Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
};
