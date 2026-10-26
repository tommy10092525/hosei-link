import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "@/client";
import type { departmentsStrict } from "server/constants";

export type Department = (typeof departmentsStrict)[number];

export const departmentKeys = {
  all: ["departments"] as const,
  summary: (department: Department) => [...departmentKeys.all, "summary", department] as const,
  messages: (department: Department) =>
    [...departmentKeys.all, "messages", department] as const,
};

/** ひろばの概要 (人数と最新の書き込み)。タイムラインの入口カード用 */
export const useDepartmentSummary = (department: Department | null) =>
  useQuery({
    queryKey: departmentKeys.summary(department as Department),
    enabled: department !== null,
    queryFn: async () => {
      const res = await client.api.departments[":department"].$get({
        param: { department: department as Department },
      });
      if (!res.ok) throw new Error("ひろばの取得に失敗しました");
      return res.json();
    },
  });

export const useDepartmentMessages = (department: Department) =>
  useQuery({
    queryKey: departmentKeys.messages(department),
    queryFn: async () => {
      const res = await client.api.departments[":department"].messages.$get({
        param: { department },
        query: {},
      });
      if (!res.ok) throw new Error("メッセージの取得に失敗しました");
      return res.json();
    },
    refetchInterval: 5_000,
  });

export const useSendDepartmentMessage = (department: Department) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (text: string) => {
      const res = await client.api.departments[":department"].messages.$post({
        param: { department },
        json: { text },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "送信に失敗しました");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: departmentKeys.all }),
  });
};

export const useDeleteDepartmentMessage = (department: Department) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await client.api.departments[":department"].messages[":messageId"].$delete({
        param: { department, messageId },
      });
      if (!res.ok) throw new Error("削除に失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: departmentKeys.all }),
  });
};
