import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/Wordmark";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import type { SetupState } from "@/hooks/useSetupGuard";
import { departmentsStrict, projectName } from "server/constants";

/**
 * 初回ログイン後のプロフィール設定。
 *
 * magic link で作られた直後のユーザーは name が空・学部が未設定。
 * 閲覧はこの画面を飛ばしてもできるが、投稿・いいね・フォロー・履修登録などの
 * 操作をしようとすると useSetupGuard / SetupPrompt からここに誘導される。
 * 誘導元の画面は location.state.from に入っていて、終わったらそこへ戻す。
 *
 * 入力は名前と学部だけに絞っている (学科・自己紹介はプロフィール編集で後から)。
 */
export const ProfileSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as SetupState | null)?.from ?? "/timeline";
  const { data, isPending } = useProfile();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  // 設定済みの人が URL 直打ちで来た場合は戻す
  if (data && !data.needsSetup) {
    return <Navigate to={from} replace />;
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim() === "" || department === "") {
      toast.error("名前と学部は必須です");
      return;
    }

    updateProfile.mutate(
      {
        name: name.trim(),
        department,
        public: isPublic,
      },
      {
        onSuccess: () => navigate(from, { replace: true }),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="bg-muted flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <Wordmark />
      <Card className="w-full max-w-lg">
        <CardHeader>
          <span className="eyebrow text-brand-strong">WELCOME</span>
          <h1 className="text-2xl leading-8 font-bold">プロフィールの設定</h1>
          <p className="text-muted-foreground text-sm leading-[22px]">
            名前と学部を設定すると、{projectName} で投稿や授業のチャットができるようになります。
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-1">
              <Label htmlFor="name">名前 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="department">学部 *</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="department" className="w-full">
                  <SelectValue placeholder="学部を選択" />
                </SelectTrigger>
                <SelectContent>
                  {departmentsStrict.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-sm border-2 border-input p-4">
              <div className="space-y-1">
                <Label htmlFor="public">アカウントを公開する</Label>
                <p className="text-muted-foreground text-xs leading-[18px]">
                  オフのままだと、あなたの投稿はあなたがフォローした人にだけ表示されます。
                  あとから変更できます。
                </p>
              </div>
              <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "保存中..." : "はじめる"}
            </Button>

            <Button variant="ghost" className="w-full" asChild>
              <Link to={from} replace>
                あとで設定して、先に中を見てみる
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
