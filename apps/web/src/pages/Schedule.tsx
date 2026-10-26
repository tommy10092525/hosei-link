import { BookOpen, Search } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/Notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClassMessageCounts,
  useMarkScheduleViewed,
  useRegisters,
} from "@/hooks/useClasses";
import { isScheduledSlot } from "@/lib/format";
import { periods, youbiList } from "server/constants";

/**
 * 曜日・時限を持たない授業に添える日程の表記。
 * timeInnerHTML はシラバス由来の生の文字列で、
 * 「集中・その他/intensive・other courses」のように読める値のこともあれば、
 * "--" や空文字、資料の URL が入っていることもあるので、後者は出さない。
 */
const scheduleNote = (raw: string | null | undefined): string => {
  const text = raw?.trim() ?? "";
  if (text === "" || text === "--" || /^https?:\/\//.test(text)) return "日程未定";
  return text;
};

/**
 * 時間割。旧 app/schedule/** の置き換え。
 *
 * 週に複数コマある授業は slots が複数返るので、同じ授業が該当するセル全部に出る。
 * 旧実装は授業1件につき1コマしか持てなかったため、片方のコマが表示できなかった。
 */
export const Schedule = () => {
  const { data, isPending } = useRegisters();
  const { data: counts } = useClassMessageCounts();
  const markViewed = useMarkScheduleViewed();

  // ページを開いたら新着バッジをリセットする
  useEffect(() => {
    markViewed.mutate();
    // 初回マウント時のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countByClass = new Map(
    (counts?.classCounts ?? []).map((row) => [row.classId, row.count]),
  );

  // (曜日, 時限) から授業を引けるようにする
  const cells = new Map<string, { id: string; title: string; place: string }>();
  // 曜日・時限を持たない授業。グリッドの下に一覧で出す
  const unscheduled: {
    id: string;
    title: string;
    place: string;
    timeInnerHTML: string;
  }[] = [];

  for (const entry of data?.registers ?? []) {
    const placeable = entry.class.slots.filter(isScheduledSlot);

    if (placeable.length === 0) {
      unscheduled.push({
        id: entry.class.id,
        title: entry.class.title,
        place: entry.class.place,
        timeInnerHTML: entry.class.timeInnerHTML,
      });
      continue;
    }

    for (const slot of placeable) {
      cells.set(`${slot.youbi}-${slot.time}`, {
        id: entry.class.id,
        title: entry.class.title,
        place: entry.class.place,
      });
    }
  }

  const header = (
    <AppHeader
      title="時間割"
      actions={
        <Button variant="ghost" size="icon" asChild>
          <Link to="/find">
            <Search />
            <span className="sr-only">授業を探す</span>
          </Link>
        </Button>
      }
    />
  );

  if (isPending) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </>
    );
  }

  const isEmpty = cells.size === 0 && unscheduled.length === 0;

  return (
    <>
      {header}

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-4">
        {isEmpty && (
          <EmptyState
            icon={BookOpen}
            action={
              <Button asChild>
                <Link to="/find">授業を探す</Link>
              </Button>
            }
          >
            授業を履修登録すると、ここに時間割ができます。同じ授業の人とも話せるようになります。
          </EmptyState>
        )}

        <div className="bg-card overflow-x-auto rounded-lg border p-2 shadow-card">
          <table className="w-full min-w-[640px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-8" />
                {youbiList.map((youbi) => (
                  <th key={youbi} className="py-1 text-sm font-bold">
                    {youbi}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period}>
                  <th className="text-muted-foreground font-mono text-xs font-medium">
                    {period}
                  </th>
                  {youbiList.map((youbi) => {
                    const cell = cells.get(`${youbi}-${period}`);
                    const unread = cell ? (countByClass.get(cell.id) ?? 0) : 0;

                    return (
                      <td key={youbi} className="align-top">
                        {cell ? (
                          <Link
                            to={`/class/${cell.id}`}
                            className="bg-brand-tint hover:border-brand-strong block h-24 rounded-sm border-2 border-transparent p-2 transition-colors"
                          >
                            <div className="flex items-start gap-1">
                              <span className="line-clamp-3 text-xs leading-4 font-bold">
                                {cell.title}
                              </span>
                              {unread > 0 && (
                                <Badge className="ml-auto shrink-0 px-1.5">
                                  {unread}
                                  <span className="sr-only">件の新着</span>
                                </Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground mt-1 block truncate text-[11px] leading-4">
                              {cell.place}
                            </span>
                          </Link>
                        ) : (
                          <div className="bg-muted h-24 rounded-sm" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/*
          集中講義など曜日・時限を持たない授業。
          グリッドには置けないが履修していることに変わりはないので、下に一覧で出す。
        */}
        {unscheduled.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg leading-[26px] font-bold">その他の授業</h2>
            <p className="text-muted-foreground text-sm leading-[22px]">
              集中講義など、曜日・時限が決まっていない授業です。
            </p>
            <ul className="space-y-2">
              {unscheduled.map((item) => {
                const unread = countByClass.get(item.id) ?? 0;

                return (
                  <li key={item.id}>
                    <Link
                      to={`/class/${item.id}`}
                      className="bg-card hover:bg-accent flex items-center gap-3 rounded-lg border px-4 py-3 shadow-card transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{item.title}</p>
                        <p className="text-muted-foreground truncate text-sm leading-[22px]">
                          {scheduleNote(item.timeInnerHTML)}
                          {item.place && ` ・ ${item.place}`}
                        </p>
                      </div>
                      {unread > 0 && (
                        <Badge className="shrink-0">
                          {unread}
                          <span className="sr-only">件の新着</span>
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
};
