import imageCompression from "browser-image-compression";

/**
 * 画像を R2 にアップロードしてオブジェクトキーを受け取る。
 *
 * multipart/form-data なので Hono RPC ではなく素の fetch を使う
 * (要件で「ファイル送信は fetch を使ってよい」とされている箇所)。
 *
 * R2 に置くだけで変換は走らないため、縮小はここクライアント側で行う。
 * 旧実装は Cloudflare Images がリサイズしてくれていた分をこれで代替する。
 */
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

const upload = async (endpoint: string, file: File): Promise<Response> => {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);

  const form = new FormData();
  // 圧縮後は File ではなく Blob が返ることがあるので名前を付け直す
  form.append("file", compressed, file.name);

  return fetch(endpoint, {
    method: "POST",
    body: form,
    credentials: "include",
  });
};

/** 投稿に添付する画像。返り値は R2 のキー */
export const uploadPostImage = async (file: File): Promise<string> => {
  const res = await upload("/api/uploads", file);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "画像のアップロードに失敗しました");
  }
  const { key } = (await res.json()) as { key: string };
  return key;
};

/** アバター。サーバ側で user.avatarKey まで更新される */
export const uploadAvatar = async (file: File): Promise<string> => {
  const res = await upload("/api/profile/avatar", file);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "アイコンのアップロードに失敗しました");
  }
  const { avatarKey } = (await res.json()) as { avatarKey: string };
  return avatarKey;
};
