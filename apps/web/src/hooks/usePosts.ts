import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { client } from "@/client";

/**
 * 投稿まわりのデータ取得。
 *
 * 旧実装は mutation のたびに window.dispatchEvent(new CustomEvent('postsRefresh'))
 * を投げ、Posts.tsx がそれを購読して自前で state を書き換えていた。
 * ここでは queryKey の invalidate に置き換える。
 */
export const postKeys = {
  all: ["posts"] as const,
  timeline: () => [...postKeys.all, "timeline"] as const,
  detail: (id: string) => [...postKeys.all, "detail", id] as const,
  replies: (id: string) => [...postKeys.all, "replies", id] as const,
};

export const useTimeline = () =>
  useInfiniteQuery({
    queryKey: postKeys.timeline(),
    // 取得開始時刻を固定して、読み進める間に新着が入ってもページがずれないようにする。
    // 先頭ページの since は initialPageParam に入れず、取得のたびに決める。
    // refetch (投稿後の invalidate など) は保存済みの先頭 pageParam を使い回すので、
    // ここに Date.now() を入れるとマウント時刻で固定され、それ以降の投稿が出なくなる。
    // 2ページ目以降は先頭ページが決めた since を引き継ぐ (refetch 時も getNextPageParam で再計算される)
    initialPageParam: { offset: 0, since: null as number | null },
    queryFn: async ({ pageParam }) => {
      const since = pageParam.since ?? Date.now();
      const res = await client.api.posts.$get({
        query: {
          offset: String(pageParam.offset),
          since: String(since),
        },
      });
      if (!res.ok) throw new Error("タイムラインの取得に失敗しました");
      return { ...(await res.json()), since };
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? { offset: allPages.length * 20, since: lastPage.since }
        : undefined,
  });

/** 投稿1件 */
export const usePost = (id: string) =>
  useQuery({
    queryKey: postKeys.detail(id),
    queryFn: async () => {
      const res = await client.api.posts[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("投稿の取得に失敗しました");
      return res.json();
    },
  });

/** ある投稿への返信一覧 */
export const usePostReplies = (id: string) =>
  useQuery({
    queryKey: postKeys.replies(id),
    queryFn: async () => {
      const res = await client.api.posts[":id"].replies.$get({ param: { id } });
      if (!res.ok) throw new Error("返信の取得に失敗しました");
      return res.json();
    },
  });

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      content: string;
      imageKeys?: string[];
      parentPostId?: string;
    }) => {
      const res = await client.api.posts.$post({ json: input });
      if (!res.ok) throw new Error("投稿に失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
};

export const useToggleReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const res = await client.api.posts[":id"].reaction.$post({
        param: { id: postId },
      });
      if (!res.ok) throw new Error("いいねに失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const res = await client.api.posts[":id"].$delete({ param: { id: postId } });
      if (!res.ok) throw new Error("削除に失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
};
