import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReportPost } from "@/hooks/useSocial";

const REASONS = [
  "誹謗中傷・嫌がらせ",
  "誤った情報・デマ",
  "個人情報が書かれている",
  "スパム・宣伝",
  "その他",
] as const;

type Props = {
  postId: string;
  children: ReactNode;
};

/**
 * 通報の確認。理由を選んでから送る。
 * サーバは自由記述の text だけを受け取るので、選んだ理由と補足を1つの文字列にまとめて送る。
 */
export const ReportDialog = ({ postId, children }: Props) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const report = useReportPost();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (reason === "") return;

    const text = detail.trim() === "" ? reason : `${reason}\n${detail.trim()}`;

    report.mutate(
      { postId, text },
      {
        onSuccess: () => {
          toast.success("通報を受け付けました");
          setReason("");
          setDetail("");
          setOpen(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>この投稿を通報しますか？</DialogTitle>
          <DialogDescription>理由を選んでください。運営が内容を確認します。</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <fieldset className="grid gap-2">
            <legend className="sr-only">通報の理由</legend>
            {REASONS.map((item) => (
              <label
                key={item}
                className="has-[:checked]:border-brand-strong has-[:checked]:bg-brand-tint flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border-2 border-input px-4"
              >
                <input
                  type="radio"
                  name="reason"
                  value={item}
                  checked={reason === item}
                  onChange={() => setReason(item)}
                  className="accent-brand-strong size-5"
                  required
                />
                {item}
              </label>
            ))}
          </fieldset>

          <div className="grid gap-1">
            <Label htmlFor="report-detail">補足（任意）</Label>
            <Textarea
              id="report-detail"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              maxLength={10000}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={report.isPending || reason === ""}
            >
              {report.isPending ? "送信中..." : "通報する"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
