import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { profileKeys, useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { uploadAvatar } from "@/lib/upload";
import { departmentsStrict } from "server/constants";

/** プロフィール編集。旧 app/profile/** の置き換え */
export const ProfileEdit = () => {
  const queryClient = useQueryClient();
  const { data, isPending } = useProfile();
  const updateProfile = useUpdateProfile();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 取得できたら一度だけフォームに流し込む
  useEffect(() => {
    if (!data) return;
    setName(data.profile.name);
    setDepartment(data.profile.department ?? "");
    setMajor(data.profile.major ?? "");
    setBio(data.profile.bio ?? "");
    setIsPublic(data.profile.public);
    setWeeklyDigest(data.profile.weeklyDigest);
  }, [data]);

  const changeAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
      await queryClient.invalidateQueries({ queryKey: profileKeys.me });
      toast.success("アイコンを変更しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile.mutate(
      {
        name: name.trim(),
        department: department || undefined,
        major: major.trim(),
        bio: bio.trim(),
        public: isPublic,
        weeklyDigest,
      },
      {
        onSuccess: () => toast.success("プロフィールを更新しました"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (isPending) {
    return (
      <>
        <AppHeader title="プロフィールを編集" back="/timeline" />
        <div className="mx-auto max-w-lg px-4 py-4">
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader
        title="プロフィールを編集"
        back={data ? `/user/${data.profile.id}` : "/timeline"}
      />
    <div className="mx-auto max-w-lg px-4 py-4">
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={data?.profile.name}
              avatarKey={data?.profile.avatarKey}
              className="size-20 *:text-3xl"
            />
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <Camera className="size-4" />
                {uploading ? "アップロード中..." : "アイコンを変更"}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => void changeAvatar(event.target.files?.[0])}
              />
            </div>
          </div>

          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-1">
              <Label htmlFor="name">名前</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="department">学部</Label>
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

            <div className="grid gap-1">
              <Label htmlFor="major">学科・専攻</Label>
              <Input
                id="major"
                value={major}
                onChange={(event) => setMajor(event.target.value)}
                maxLength={255}
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="bio">自己紹介</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={1000}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-sm border-2 border-input p-4">
              <div className="space-y-1">
                <Label htmlFor="public">アカウントを公開する</Label>
                <p className="text-muted-foreground text-xs leading-[18px]">
                  オフにすると、あなたの投稿はあなたがフォローした人にだけ表示されます。
                </p>
              </div>
              <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-sm border-2 border-input p-4">
              <div className="space-y-1">
                <Label htmlFor="weeklyDigest">週1回のお知らせメール</Label>
                <p className="text-muted-foreground text-xs leading-[18px]">
                  学部ひろばや履修中の授業に新着があった週だけ、月曜の朝にまとめて届きます。
                </p>
              </div>
              <Switch
                id="weeklyDigest"
                checked={weeklyDigest}
                onCheckedChange={setWeeklyDigest}
              />
            </div>

            <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "保存中..." : "保存する"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </>
  );
};
