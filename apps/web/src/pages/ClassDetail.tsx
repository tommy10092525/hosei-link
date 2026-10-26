import { ExternalLink, MessagesSquare, Star, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState, Notice } from "@/components/Notice";
import { SetupPrompt } from "@/components/SetupPrompt";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useClass,
  useClassMembers,
  useClassReviews,
  useDeleteReview,
  useSubmitReview,
  useToggleRegister,
} from "@/hooks/useClasses";
import { useProfile } from "@/hooks/useProfile";
import { useSetupGuard } from "@/hooks/useSetupGuard";
import { displayName, isScheduledSlot, slotLabel, timeAgo } from "@/lib/format";

/** 評価は星だけでなく数値も併記する (星は読み上げない) */
const Stars = ({ value }: { value: number }) => {
  const filled = Math.round(value);
  return (
    <span aria-hidden className="text-brand-strong">
      {"★".repeat(filled)}
      {"☆".repeat(5 - filled)}
    </span>
  );
};

/** 授業ページ。旧 app/class/[id]/** の置き換え */
export const ClassDetail = () => {
  const { id = "" } = useParams();
  const { data, isPending } = useClass(id);
  const members = useClassMembers(id);
  const reviews = useClassReviews(id);
  const { data: me } = useProfile();
  const toggleRegister = useToggleRegister();
  const submitReview = useSubmitReview(id);
  const { needsSetup, guard } = useSetupGuard();
  const deleteReview = useDeleteReview(id);

  const [text, setText] = useState("");
  const [rating, setRating] = useState("3");

  if (isPending) {
    return (
      <>
        <AppHeader title="授業" back="/schedule" />
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AppHeader title="授業" back="/schedule" />
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Notice variant="error">授業が見つかりません。URL を確かめてください。</Notice>
        </div>
      </>
    );
  }

  const klass = data.class;
  const average = reviews.data?.average;

  return (
    <>
      <AppHeader title={klass.title} back="/schedule" />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {klass.slots.map((slot) => (
                  <Badge key={`${slot.youbi}${slot.time}`} variant="tag">
                    {isScheduledSlot(slot) ? `${slotLabel(slot)}限` : slotLabel(slot)}
                  </Badge>
                ))}
                {klass.online && <Badge variant="tag">オンライン</Badge>}
                {klass.place && <Badge variant="tag">{klass.place}</Badge>}
              </div>
              <h2 className="text-2xl leading-8 font-bold">{klass.title}</h2>
              <p className="text-muted-foreground text-sm leading-[22px]">
                {klass.teacher} ・ {klass.gakubu}
              </p>
              <p className="text-sm leading-5 font-bold">
                {average != null && (
                  <>
                    総合 <Stars value={average} /> {average.toFixed(1)}
                    <span className="text-muted-foreground font-normal"> ／ </span>
                  </>
                )}
                <span className="text-muted-foreground font-normal">
                  履修登録 {data.registerCount}人
                </span>
              </p>
            </div>

            {/* 主ボタンは1つ。履修登録が済んだら授業チャットが主になる */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={data.isRegistered ? "outline" : "default"}
                disabled={toggleRegister.isPending}
                onClick={() =>
                  (data.isRegistered || guard()) &&
                  toggleRegister.mutate(
                    { classId: id, isRegistered: data.isRegistered },
                    {
                      onSuccess: () =>
                        toast.success(
                          data.isRegistered ? "履修登録を解除しました" : "履修登録しました",
                        ),
                      onError: (e) => toast.error(e.message),
                    },
                  )
                }
              >
                {data.isRegistered ? "履修登録を解除" : "履修登録する"}
              </Button>

              <Button variant={data.isRegistered ? "default" : "outline"} asChild>
                <Link to={`/class/${id}/chat`}>
                  <MessagesSquare />
                  授業チャット
                </Link>
              </Button>

              <Button variant="link" asChild>
                <a href={klass.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  シラバス
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>この授業を履修している人</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {members.data && members.data.members.length > 0 ? (
              <ul className="-mx-2 space-y-1">
                {members.data.members.map((member) => (
                  <li key={member.id}>
                    <Link
                      to={`/user/${member.id}`}
                      className="hover:bg-accent flex items-center gap-3 rounded-sm p-2 transition-colors"
                    >
                      <UserAvatar name={member.name} avatarKey={member.avatarKey} />
                      <div className="min-w-0">
                        <p className="truncate text-sm leading-5 font-bold">
                          {displayName(member.name)}
                        </p>
                        <p className="text-muted-foreground truncate text-sm leading-[22px]">
                          {member.department}
                          {member.major}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Users}>
                表示できる履修者がいません。非公開アカウントの人は表示されません。
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <h2>レビュー</h2>
              {average != null && (
                <span className="text-muted-foreground flex items-center gap-1 text-sm font-normal">
                  <Star className="text-brand-strong size-4 fill-current" aria-hidden />
                  {average.toFixed(1)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsSetup ? (
              <SetupPrompt action="レビューの投稿" />
            ) : (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (text.trim() === "") return;
                  submitReview.mutate(
                    { text: text.trim(), rating: Number(rating) },
                    {
                      onSuccess: () => {
                        setText("");
                        toast.success("レビューを投稿しました");
                      },
                      onError: (e) => toast.error(e.message),
                    },
                  );
                }}
              >
                <div className="grid gap-1">
                  <Label htmlFor="review">授業の感想</Label>
                  <Textarea
                    id="review"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="課題の量や試験の形式など"
                    maxLength={10000}
                  />
                  <p className="text-muted-foreground text-xs leading-[18px]">
                    1人1件まで。もう一度投稿すると上書きされます。
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="rating">評価</Label>
                    <Select value={rating} onValueChange={setRating}>
                      <SelectTrigger id="rating" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {"★".repeat(value)} {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" variant="outline" disabled={submitReview.isPending}>
                    投稿する
                  </Button>
                </div>
              </form>
            )}

            {reviews.data && reviews.data.reviews.length > 0 ? (
              <ul className="divide-y border-t">
                {reviews.data.reviews.map((review) => (
                  <li key={review.id} className="space-y-1 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={review.author.name}
                        avatarKey={review.author.avatarKey}
                        className="size-8"
                      />
                      <span className="truncate text-sm leading-5 font-bold">
                        {displayName(review.author.name)}
                      </span>
                      <span className="flex items-center gap-0.5 text-sm font-bold">
                        <Star className="text-brand-strong size-4 fill-current" aria-hidden />
                        {review.rating}
                      </span>
                      <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                        {timeAgo(review.createdAt)}
                      </span>
                      {review.userId === me?.profile.id && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-danger"
                          onClick={() =>
                            deleteReview.mutate(review.id, {
                              onError: (e) => toast.error(e.message),
                            })
                          }
                        >
                          <Trash2 />
                          <span className="sr-only">レビューを削除</span>
                        </Button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{review.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground border-t pt-4 text-sm">
                まだレビューがありません。受講したら感想を残してみましょう。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};
