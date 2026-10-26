import { Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/Notice";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounced } from "@/hooks/useDebounced";
import { useRelations, useToggleFollow, useUserSearch } from "@/hooks/useSocial";
import { displayName } from "@/lib/format";

type Person = {
  id: string;
  name: string;
  department: string | null;
  major: string | null;
  avatarKey: string | null;
};

const PersonRow = ({
  person,
  action,
}: {
  person: Person;
  action?: React.ReactNode;
}) => (
  <div className="bg-card flex items-center gap-3 rounded-lg border px-4 py-3 shadow-card">
    <Link to={`/user/${person.id}`} tabIndex={-1} aria-hidden>
      <UserAvatar name={person.name} avatarKey={person.avatarKey} />
    </Link>
    <Link to={`/user/${person.id}`} className="min-w-0 flex-1">
      <p className="truncate font-bold">{displayName(person.name)}</p>
      <p className="text-muted-foreground truncate text-sm leading-[22px]">
        {person.department}
        {person.major}
      </p>
    </Link>
    {action}
  </div>
);

/** 友達を探す / フォロー関係の一覧。旧 app/friends/** の置き換え */
export const Friends = () => {
  const [query, setQuery] = useState("");
  // 入力欄はローカル state から即座に反映しつつ、API 呼び出しだけ遅らせる。
  // 入力のたびに検索を投げないため
  const debouncedQuery = useDebounced(query);
  const search = useUserSearch(debouncedQuery);
  const relations = useRelations();
  const toggleFollow = useToggleFollow();

  return (
    <>
      <AppHeader title="友達" back="/chat" />

      <div className="mx-auto max-w-2xl px-4 py-4">
        <Tabs defaultValue="search" className="gap-4">
          <TabsList className="bg-card w-full border">
            <TabsTrigger value="search">さがす</TabsTrigger>
            <TabsTrigger value="following">フォロー中</TabsTrigger>
            <TabsTrigger value="followers">フォロワー</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3">
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2"
                aria-hidden
              />
              <Input
                aria-label="友達をさがす"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="学部・学科・自己紹介・名前で検索"
                className="bg-card rounded-full pl-12"
              />
            </div>

            {query.trim() === "" ? (
              <EmptyState icon={Search}>
                キーワードを入力してください。非公開アカウントの人は、その人があなたをフォローしている場合のみ表示されます。
              </EmptyState>
            ) : search.isFetching ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : !search.data || search.data.users.length === 0 ? (
              <EmptyState icon={Search}>
                見つかりませんでした。別のキーワードで試してみてください。
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {search.data.users.map((person) => (
                  <li key={person.id}>
                    <PersonRow
                      person={person}
                      action={
                        <Button
                          size="sm"
                          variant={person.isFollowing ? "outline" : "ink"}
                          onClick={() =>
                            toggleFollow.mutate(
                              {
                                targetUserId: person.id,
                                isFollowing: person.isFollowing,
                              },
                              { onError: (e) => toast.error(e.message) },
                            )
                          }
                        >
                          {person.isFollowing ? "フォロー中" : "フォロー"}
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="following" className="space-y-2">
            {relations.isPending ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : relations.data?.following.length === 0 ? (
              <EmptyState icon={UserPlus}>
                気になる人をフォローすると、ここに並びます。
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {relations.data?.following.map((person) => (
                  <li key={person.id}>
                    <PersonRow
                      person={person}
                      action={
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            toggleFollow.mutate(
                              { targetUserId: person.id, isFollowing: true },
                              { onError: (e) => toast.error(e.message) },
                            )
                          }
                        >
                          解除
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="followers" className="space-y-2">
            {relations.isPending ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : relations.data?.followers.length === 0 ? (
              <EmptyState icon={Users}>
                あなたをフォローした人が、ここに並びます。
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {relations.data?.followers.map((person) => (
                  <li key={person.id}>
                    <PersonRow person={person} />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};
