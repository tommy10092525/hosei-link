import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { client } from "@/client";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** 問い合わせフォーム。旧 app/contact/** の置き換え */
export const Contact = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const res = await client.api.contact.$post({ json: { title, content } });
      if (!res.ok) throw new Error("送信に失敗しました");
      return res.json();
    },
    onSuccess: () => {
      toast.success("送信しました。ありがとうございます。");
      setTitle("");
      setContent("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AppHeader title="お問い合わせ" back="/timeline" />
    <div className="mx-auto max-w-lg px-4 py-4">
      <Card>
        <CardHeader>
          <p className="text-muted-foreground text-sm leading-[22px]">
            不具合の報告や機能の要望をお寄せください。
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim() === "" || content.trim() === "") return;
              submit.mutate();
            }}
          >
            <div className="grid gap-1">
              <Label htmlFor="title">件名</Label>
              <Input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={255}
                required
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={10000}
                rows={8}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? "送信中..." : "送信する"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
    </>
  );
};
