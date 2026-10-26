import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePost } from "@/hooks/usePosts";
import { uploadPostImage } from "@/lib/upload";

const MAX_IMAGES = 4;

type Props = {
  /** 指定すると返信になる */
  parentPostId?: string;
  placeholder?: string;
};

/**
 * 投稿フォーム。タイムラインと投稿詳細 (返信) で共用する。
 *
 * 画像は先に /api/uploads へ送って R2 のキーを受け取り、
 * 投稿本体はそのキーの配列を送る二段構え。
 */
export const PostComposer = ({ parentPostId, placeholder = "いまどうしてる？" }: Props) => {
  const createPost = useCreatePost();
  const fileInput = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [imageKeys, setImageKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const room = MAX_IMAGES - imageKeys.length;
    if (room <= 0) {
      toast.error(`画像は${MAX_IMAGES}枚までです`);
      return;
    }

    setUploading(true);
    try {
      const keys = await Promise.all(
        [...files].slice(0, room).map((file) => uploadPostImage(file)),
      );
      setImageKeys((current) => [...current, ...keys]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "画像の処理に失敗しました");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (content.trim() === "" && imageKeys.length === 0) return;

    createPost.mutate(
      { content, imageKeys, parentPostId },
      {
        onSuccess: () => {
          setContent("");
          setImageKeys([]);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Card>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={placeholder}
            maxLength={1000}
          />

          {imageKeys.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imageKeys.map((key) => (
                <div key={key} className="relative">
                  <img
                    src={`/api/images/${key}`}
                    alt=""
                    className="size-20 rounded-sm object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute -top-3 -right-3 size-8 border-2 border-card"
                    onClick={() =>
                      setImageKeys((current) => current.filter((k) => k !== key))
                    }
                  >
                    <X className="size-3" />
                    <span className="sr-only">画像を外す</span>
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading || imageKeys.length >= MAX_IMAGES}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus className="size-4" />
              {uploading ? "処理中..." : "画像"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => void pickFiles(event.target.files)}
            />

            <Button type="submit" disabled={createPost.isPending || uploading}>
              {createPost.isPending ? "送信中..." : parentPostId ? "返信する" : "投稿する"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
