import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "@/client";
import { postKeys } from "@/hooks/usePosts";

export const userKeys = {
  all: ["users"] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
  search: (q: string) => [...userKeys.all, "search", q] as const,
  relations: () => [...userKeys.all, "relations"] as const,
};

export const useUser = (id: string) =>
  useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const res = await client.api.users[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("ユーザーの取得に失敗しました");
      return res.json();
    },
  });

export const useUserSearch = (q: string) =>
  useQuery({
    queryKey: userKeys.search(q),
    // 空文字ではリクエストしない (サーバ側で min(1) を要求している)
    enabled: q.trim().length > 0,
    queryFn: async () => {
      const res = await client.api.users.search.$get({ query: { q } });
      if (!res.ok) throw new Error("検索に失敗しました");
      return res.json();
    },
  });

export const useRelations = () =>
  useQuery({
    queryKey: userKeys.relations(),
    queryFn: async () => {
      const res = await client.api.users.relations.$get();
      if (!res.ok) throw new Error("フォロー関係の取得に失敗しました");
      return res.json();
    },
  });

/** フォロー / 解除。公開範囲に影響するのでタイムラインも作り直す */
export const useToggleFollow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetUserId,
      isFollowing,
    }: {
      targetUserId: string;
      isFollowing: boolean;
    }) => {
      const json = { targetUserId };
      const res = isFollowing
        ? await client.api.follow.$delete({ json })
        : await client.api.follow.$post({ json });
      if (!res.ok) throw new Error("フォローの更新に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      void queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
};

export const useToggleBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetUserId,
      isBlocked,
    }: {
      targetUserId: string;
      isBlocked: boolean;
    }) => {
      const json = { targetUserId };
      const res = isBlocked
        ? await client.api.block.$delete({ json })
        : await client.api.block.$post({ json });
      if (!res.ok) throw new Error("ブロックの更新に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      void queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
};

export const useReportPost = () =>
  useMutation({
    mutationFn: async (input: { postId: string; text: string }) => {
      const res = await client.api.reports.$post({ json: input });
      if (!res.ok) throw new Error("通報の送信に失敗しました");
      return res.json();
    },
  });
