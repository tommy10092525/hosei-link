import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "@/client";

export const messageKeys = {
  all: ["messages"] as const,
  unread: () => [...messageKeys.all, "unread"] as const,
  thread: (peerId: string) => [...messageKeys.all, "thread", peerId] as const,
};

/**
 * 未読メッセージ。ヘッダーのバッジに使うので短い間隔で見に行く。
 * 旧実装は UnreadMessagesBadge がサーバコンポーネントで、
 * ページ遷移しないと更新されなかった。
 */
export const useUnreadMessages = () =>
  useQuery({
    queryKey: messageKeys.unread(),
    queryFn: async () => {
      const res = await client.api.messages.unread.$get();
      if (!res.ok) throw new Error("未読の取得に失敗しました");
      return res.json();
    },
    refetchInterval: 30_000,
  });

/**
 * 相手とのやりとり。
 * 旧実装は setInterval で since を渡して差分取得していたが、
 * TanStack Query の refetchInterval に置き換えている。
 */
export const useThread = (peerId: string) =>
  useQuery({
    queryKey: messageKeys.thread(peerId),
    queryFn: async () => {
      const res = await client.api.messages.$get({ query: { peerId } });
      if (!res.ok) throw new Error("メッセージの取得に失敗しました");
      return res.json();
    },
    refetchInterval: 5_000,
  });

export const useSendMessage = (peerId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await client.api.messages.$post({ json: { peerId, content } });
      if (!res.ok) throw new Error("送信に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.thread(peerId) });
      void queryClient.invalidateQueries({ queryKey: messageKeys.unread() });
    },
  });
};
