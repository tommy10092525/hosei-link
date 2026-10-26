import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "@/client";

export type ClassSearchParams = {
  title?: string;
  teacher?: string;
  gakubu?: string;
  youbi?: string;
  time?: string;
  online?: "true" | "false";
};

export const classKeys = {
  all: ["classes"] as const,
  search: (params: ClassSearchParams) => [...classKeys.all, "search", params] as const,
  detail: (id: string) => [...classKeys.all, "detail", id] as const,
  members: (id: string) => [...classKeys.all, "members", id] as const,
  messages: (id: string) => [...classKeys.all, "messages", id] as const,
  reviews: (id: string) => [...classKeys.all, "reviews", id] as const,
};

export const scheduleKeys = {
  all: ["schedule"] as const,
  registers: () => [...scheduleKeys.all, "registers"] as const,
  classCounts: () => [...scheduleKeys.all, "classCounts"] as const,
  newCount: () => [...scheduleKeys.all, "newCount"] as const,
};

/**
 * 授業検索。
 * 旧実装は 5.8MB の JSON をバンドルに同梱してクライアントで全件フィルタしていた。
 * ここはサーバの SQL 検索を叩くだけになっている。
 */
export const useClassSearch = (params: ClassSearchParams, enabled: boolean) =>
  useQuery({
    queryKey: classKeys.search(params),
    enabled,
    queryFn: async () => {
      const res = await client.api.classes.$get({ query: params });
      if (!res.ok) throw new Error("授業の検索に失敗しました");
      return res.json();
    },
  });

export const useClass = (id: string) =>
  useQuery({
    queryKey: classKeys.detail(id),
    queryFn: async () => {
      const res = await client.api.classes[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("授業の取得に失敗しました");
      return res.json();
    },
  });

export const useClassMembers = (id: string) =>
  useQuery({
    queryKey: classKeys.members(id),
    queryFn: async () => {
      const res = await client.api.classes[":id"].members.$get({ param: { id } });
      if (!res.ok) throw new Error("履修者の取得に失敗しました");
      return res.json();
    },
  });

export const useClassMessages = (id: string) =>
  useQuery({
    queryKey: classKeys.messages(id),
    queryFn: async () => {
      // limit / since は省略可だが query オブジェクト自体は必須 (RPC の型が教えてくれる)
      const res = await client.api.classes[":id"].messages.$get({
        param: { id },
        query: {},
      });
      if (!res.ok) throw new Error("メッセージの取得に失敗しました");
      return res.json();
    },
    refetchInterval: 5_000,
  });

export const useSendClassMessage = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (text: string) => {
      const res = await client.api.classes[":id"].messages.$post({
        param: { id },
        json: { text },
      });
      if (!res.ok) throw new Error("送信に失敗しました");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: classKeys.messages(id) }),
  });
};

export const useDeleteClassMessage = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await client.api.classes[":id"].messages[":messageId"].$delete({
        param: { id, messageId },
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: classKeys.messages(id) }),
  });
};

export const useClassReviews = (id: string) =>
  useQuery({
    queryKey: classKeys.reviews(id),
    queryFn: async () => {
      const res = await client.api.classes[":id"].reviews.$get({ param: { id } });
      if (!res.ok) throw new Error("レビューの取得に失敗しました");
      return res.json();
    },
  });

export const useSubmitReview = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { text: string; rating: number }) => {
      const res = await client.api.classes[":id"].reviews.$post({
        param: { id },
        json: { text: input.text, rating: String(input.rating) },
      });
      if (!res.ok) throw new Error("レビューの投稿に失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classKeys.reviews(id) }),
  });
};

export const useDeleteReview = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await client.api.classes[":id"].reviews[":reviewId"].$delete({
        param: { id, reviewId },
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classKeys.reviews(id) }),
  });
};

/* ---------------- 履修登録・時間割 ---------------- */

export const useRegisters = () =>
  useQuery({
    queryKey: scheduleKeys.registers(),
    queryFn: async () => {
      const res = await client.api.registers.$get();
      if (!res.ok) throw new Error("履修一覧の取得に失敗しました");
      return res.json();
    },
  });

export const useToggleRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      classId,
      isRegistered,
    }: {
      classId: string;
      isRegistered: boolean;
    }) => {
      const json = { classId };
      const res = isRegistered
        ? await client.api.registers.$delete({ json })
        : await client.api.registers.$post({ json });
      if (!res.ok) throw new Error("履修登録の更新に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      void queryClient.invalidateQueries({ queryKey: classKeys.all });
    },
  });
};

/** 授業ごとの未読件数 */
export const useClassMessageCounts = () =>
  useQuery({
    queryKey: scheduleKeys.classCounts(),
    queryFn: async () => {
      const res = await client.api.schedule["class-message-counts"].$get();
      if (!res.ok) throw new Error("未読件数の取得に失敗しました");
      return res.json();
    },
  });

/** 時間割全体の新着件数。ヘッダーのバッジ用 */
export const useNewMessagesCount = () =>
  useQuery({
    queryKey: scheduleKeys.newCount(),
    queryFn: async () => {
      const res = await client.api.schedule["new-messages-count"].$get();
      if (!res.ok) throw new Error("新着件数の取得に失敗しました");
      return res.json();
    },
    refetchInterval: 60_000,
  });

/** 時間割ページを開いたことを記録する */
export const useMarkScheduleViewed = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.user["schedule-view"].$patch();
      if (!res.ok) throw new Error("既読の記録に失敗しました");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleKeys.newCount() }),
  });
};

/** 授業チャットを開いたことを記録する */
export const useMarkClassViewed = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classId: string) => {
      const res = await client.api.schedule.class[":classId"].view.$patch({
        param: { classId },
      });
      if (!res.ok) throw new Error("既読の記録に失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
};
