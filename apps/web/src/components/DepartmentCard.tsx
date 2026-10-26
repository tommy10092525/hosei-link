import { ChevronRight, MessagesSquare } from "lucide-react";
import { Link } from "react-router";

import { type Department, useDepartmentSummary } from "@/hooks/useDepartments";
import { useProfile } from "@/hooks/useProfile";
import { timeAgo } from "@/lib/format";

/**
 * タイムライン上部に出す、自分の学部ひろばへの入口。
 * 学部が未設定 (セットアップ前) なら出さない。
 */
export const DepartmentCard = () => {
  const { data: profile } = useProfile();
  const department = (profile?.profile.department ?? null) as Department | null;
  const { data } = useDepartmentSummary(department);

  if (!department) return null;

  return (
    <Link
      to={`/hiroba/${department}`}
      className="bg-card hover:bg-accent flex items-center gap-3 rounded-lg border p-4 shadow-card transition-colors"
    >
      <MessagesSquare className="text-brand-strong size-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 font-bold">
          {department}ひろば
          {data && (
            <span className="text-muted-foreground ml-2 font-normal">
              {data.memberCount}人
            </span>
          )}
        </p>
        <p className="text-muted-foreground truncate text-sm leading-[22px]">
          {data?.latest
            ? `${timeAgo(data.latest.createdAt)} ・ ${data.latest.text}`
            : "同じ学部の人と、履修や試験の情報を交換できます"}
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
    </Link>
  );
};
