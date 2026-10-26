import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "@/client";

export const profileKeys = {
  me: ["profile", "me"] as const,
};

/**
 * 自分のプロフィール。
 * needsSetup が true なら初回セットアップが未完了 (name が空 or 学部が未設定)。
 */
export const useProfile = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: profileKeys.me,
    enabled,
    queryFn: async () => {
      const res = await client.api.profile.$get();
      if (!res.ok) throw new Error("プロフィールの取得に失敗しました");
      return res.json();
    },
  });

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name?: string;
      department?: string;
      major?: string;
      bio?: string;
      public?: boolean;
      weeklyDigest?: boolean;
    }) => {
      const res = await client.api.profile.$patch({
        // department はサーバ側で enum 検証される
        json: input as Parameters<typeof client.api.profile.$patch>[0]["json"],
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "プロフィールの更新に失敗しました");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.me }),
  });
};
