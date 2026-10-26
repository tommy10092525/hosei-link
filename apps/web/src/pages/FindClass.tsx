import { BookOpen, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/Notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassSearch, type ClassSearchParams } from "@/hooks/useClasses";
import { useDebounced } from "@/hooks/useDebounced";
import { isScheduledSlot, slotLabel } from "@/lib/format";
import { departments, periods, youbiList } from "server/constants";

const ANY = "*";

type Filters = {
  title: string;
  teacher: string;
  gakubu: string;
  youbi: string;
  time: string;
};

/**
 * 授業検索。旧 app/find/** + components/client/SearchForm.tsx の置き換え。
 *
 * 旧実装は 13,783 件・5.8MB のシラバス JSON をクライアントバンドルに同梱し、
 * JS で全件フィルタしていた。ここではサーバの SQL 検索を叩くだけなので、
 * バンドルにも初期ロードにも授業データは一切乗らない。
 *
 * 【入力状態の持ち方について】
 * 検索条件は共有できるよう URL のクエリにも持たせるが、
 * 入力欄の value は必ずローカル state から供給すること。
 * value を useSearchParams から直接引くと、キー入力のたびに
 * ルーターの遷移 -> 再レンダリングが挟まり、value の反映が一拍遅れる。
 * するとReactが古い値をDOMに書き戻して IME の変換中の文字列が消えてしまう
 * (日本語が入力できない)。URL への反映はデバウンスして後追いで行う。
 */
export const FindClass = () => {
  const [params, setParams] = useSearchParams();

  // 初期値だけ URL から取り、以降はこのローカル state が入力の唯一の source of truth
  const [filters, setFilters] = useState<Filters>(() => ({
    title: params.get("title") ?? "",
    teacher: params.get("teacher") ?? "",
    gakubu: params.get("gakubu") ?? ANY,
    youbi: params.get("youbi") ?? ANY,
    time: params.get("time") ?? ANY,
  }));

  const debounced = useDebounced(filters);
  const lastSynced = useRef<string | null>(null);

  const update = (key: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  // URL への反映はデバウンス後にまとめて行う (replace なので履歴は増やさない)
  useEffect(() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(debounced)) {
      if (value !== "" && value !== ANY) next.set(key, value);
    }

    // setParams の identity が変わっても無限ループしないよう、
    // 直前に書いた内容と同じならスキップする
    const serialized = next.toString();
    if (lastSynced.current === serialized) return;
    lastSynced.current = serialized;

    setParams(next, { replace: true });
  }, [debounced, setParams]);

  const query: ClassSearchParams = {
    ...(debounced.title && { title: debounced.title }),
    ...(debounced.teacher && { teacher: debounced.teacher }),
    ...(debounced.gakubu !== ANY && { gakubu: debounced.gakubu }),
    ...(debounced.youbi !== ANY && { youbi: debounced.youbi }),
    ...(debounced.time !== ANY && { time: debounced.time }),
  };

  // 条件が1つもないと全件になってしまうので、何か入力されるまで検索しない
  const hasQuery = Object.keys(query).length > 0;
  const { data, isFetching } = useClassSearch(query, hasQuery);

  return (
    <>
      <AppHeader title="授業を探す" back="/schedule" />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id="title"
            aria-label="授業名"
            value={filters.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="授業名で検索（例: 環境法）"
            className="bg-card rounded-full pl-12"
          />
        </div>

        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="teacher">教員名</Label>
              <Input
                id="teacher"
                value={filters.teacher}
                onChange={(event) => update("teacher", event.target.value)}
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="gakubu">学部・科目区分</Label>
              <Select
                value={filters.gakubu}
                onValueChange={(value) => update("gakubu", value)}
              >
                <SelectTrigger id="gakubu" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>指定しない</SelectItem>
                  {departments.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="youbi">曜日</Label>
              <Select
                value={filters.youbi}
                onValueChange={(value) => update("youbi", value)}
              >
                <SelectTrigger id="youbi" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>指定しない</SelectItem>
                  {youbiList.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="time">時限</Label>
              <Select
                value={filters.time}
                onValueChange={(value) => update("time", value)}
              >
                <SelectTrigger id="time" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>指定しない</SelectItem>
                  {periods.map((item) => (
                    <SelectItem key={item} value={String(item)}>
                      {item}限
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!hasQuery ? (
          <EmptyState icon={BookOpen}>
            授業名・教員名・曜日などを入力すると、シラバスに載っている授業から探せます。
          </EmptyState>
        ) : isFetching ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : !data || data.classes.length === 0 ? (
          <EmptyState icon={Search}>
            条件に合う授業が見つかりませんでした。条件を減らして試してみてください。
          </EmptyState>
        ) : (
          <>
            <p className="text-muted-foreground text-sm leading-[22px]" role="status">
              {data.classes.length}件{data.hasMore && "以上"}見つかりました
            </p>
            <ul className="space-y-3">
              {data.classes.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/class/${item.id}`}
                    className="bg-card hover:bg-accent block rounded-lg border p-4 shadow-card transition-colors"
                  >
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {item.slots.map((slot) => (
                        <Badge key={`${slot.youbi}${slot.time}`} variant="tag">
                          {isScheduledSlot(slot) ? `${slotLabel(slot)}限` : slotLabel(slot)}
                        </Badge>
                      ))}
                      {item.online && <Badge variant="tag">オンライン</Badge>}
                    </div>
                    <h2 className="text-lg leading-[26px] font-bold">{item.title}</h2>
                    <p className="text-muted-foreground text-sm leading-[22px]">
                      {item.teacher} ・ {item.gakubu} ・ {item.place}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
};
