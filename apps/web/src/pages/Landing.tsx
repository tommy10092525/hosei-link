import {
  BookOpen,
  Check,
  CircleUser,
  Flag,
  Megaphone,
  MessageSquare,
  Search,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { toast } from "sonner";

import { Notice } from "@/components/Notice";
import { Wordmark } from "@/components/Wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { universityEmailDomain } from "server/constants";

import icon from "../../icon.png";

const EMAIL_INPUT_ID = "login-email";

/**
 * アンケートの数字には、必ず対象・期間・回答形式を同じ面に添える。
 * 回答者の割合であって、全学生の割合として書かないこと。
 */
const SURVEY_NOTE = "学生64名を対象に、2日間実施したアンケート。複数回答。";

/** CTA から入力欄へ移動する。hash router なので #id のリンクは使えない */
const focusLoginForm = () => {
  const input = document.getElementById(EMAIL_INPUT_ID);
  input?.scrollIntoView({ behavior: "smooth", block: "center" });
  input?.focus({ preventScroll: true });
};

const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("eyebrow text-brand-strong", className)}>{children}</span>
);

const SectionTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2
    className={cn(
      "text-[clamp(26px,3.4vw,36px)] leading-[1.35] font-black text-balance",
      className,
    )}
  >
    {children}
  </h2>
);

const SurveyBar = ({
  label,
  value,
  muted = false,
  tone = "brand",
}: {
  label: string;
  value: number;
  muted?: boolean;
  tone?: "brand" | "trust";
}) => (
  <div className="grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-1">
    <span className={cn("text-sm leading-5 font-bold", muted && "text-muted-foreground")}>
      {label}
    </span>
    <span className={cn("text-xl leading-6 font-black", muted && "text-muted-foreground")}>
      {value}%
    </span>
    <div
      role="img"
      aria-label={`${value}%`}
      className="bg-muted col-span-2 h-3 overflow-hidden rounded-full border border-input"
    >
      <div
        className={cn(
          "h-full rounded-full",
          muted ? "bg-line-strong" : tone === "trust" ? "bg-trust" : "bg-primary",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * 画面イメージ (スマホの枠に入れたアプリ画面)。中身はサンプル表記にする
 * ------------------------------------------------------------------ */

const PhoneFrame = ({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div
    aria-hidden
    className={cn("bg-ink w-60 rounded-[40px] p-2 shadow-sheet select-none", className)}
  >
    <div className="bg-surface-sunken text-ink h-[400px] overflow-hidden rounded-[32px]">
      <div className="bg-surface-raised flex min-h-13 items-center justify-between border-b px-4 font-bold">
        {title}
      </div>
      <div className="flex flex-col gap-2 p-3">{children}</div>
    </div>
  </div>
);

const MockCard = ({ children }: { children: ReactNode }) => (
  <div className="bg-surface-raised rounded-lg border p-3">{children}</div>
);

const MockCourse = ({
  name,
  voices,
  rating,
  workload,
}: {
  name: string;
  voices: number;
  rating?: string;
  workload?: string;
}) => (
  <MockCard>
    <p className="text-sm leading-5 font-bold">{name}</p>
    <p className="text-muted-foreground text-xs leading-[18px]">受講者の声 {voices}件</p>
    {rating && <p className="mt-1 text-[13px] leading-[18px] font-bold">総合 {rating}</p>}
    {workload && (
      <p className="text-muted-foreground mt-1 text-xs leading-[18px]">課題量：{workload}</p>
    )}
  </MockCard>
);

const MockAvatar = ({ char, className }: { char: string; className: string }) => (
  <span
    className={cn(
      "text-on-accent grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-black",
      className,
    )}
  >
    {char}
  </span>
);

const MockPost = ({
  char,
  name,
  avatar,
  children,
}: {
  char: string;
  name: string;
  avatar: string;
  children: ReactNode;
}) => (
  <MockCard>
    <div className="mb-1.5 flex items-center gap-2">
      <MockAvatar char={char} className={avatar} />
      <span className="text-[13px] leading-[18px] font-bold">{name}</span>
    </div>
    <p className="text-[13px] leading-5">{children}</p>
  </MockCard>
);

const MockMember = ({ char, name, avatar }: { char: string; name: string; avatar: string }) => (
  <div className="bg-surface-raised flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
    <MockAvatar char={char} className={cn("size-8 text-sm", avatar)} />
    <div>
      <p className="text-[13px] leading-[18px] font-bold">{name}</p>
      <p className="text-muted-foreground text-[11px] leading-4">サンプル学部</p>
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * セクションの中身
 * ------------------------------------------------------------------ */

const VOICES = [
  "同じ授業なのに、話したことがない",
  "学部の外に、知り合いがいない",
  "課題や試験のこと、聞ける人がいない",
];

const FEATURES: {
  icon: LucideIcon;
  title: string;
  body: string;
  available: boolean;
}[] = [
  {
    icon: BookOpen,
    title: "授業選びで、失敗しにくくなる",
    body: "受講した学生の評価や感想を、授業ごとに読めます。授業名や曜日・時限から授業を探すこともできます。",
    available: true,
  },
  {
    icon: MessageSquare,
    title: "課題や試験のことを、気軽に聞ける",
    body: "授業ごとの場所で、同じ授業を受けている学生と情報交換できます。",
    available: true,
  },
  {
    icon: Users,
    title: "学部や授業の外にも、知り合いができる",
    body: "同じ学部・学科や、趣味の共通点からつながれるようにする予定です。",
    available: false,
  },
  {
    icon: Megaphone,
    title: "サークルやイベントの情報が届く",
    body: "サークルや学内イベントの告知を、まとめて見られるようにする予定です。",
    available: false,
  },
];

const SAFETY: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "法政大学生だけが使えます",
    body: "登録時に、学内メールアドレスで認証を行います。",
  },
  {
    icon: Flag,
    title: "通報・ブロックができます",
    body: "気になる投稿やユーザーを運営に報告したり、表示しないようにしたりできます。",
  },
  {
    icon: CircleUser,
    title: "誰の投稿かが分かります",
    body: "投稿にはニックネームが表示されます。匿名での投稿機能はありません。",
  },
];

/** 共通点でつながる図。SVG なので画面幅に合わせて縮む */
const ConnectionDiagram = () => (
  <svg
    viewBox="0 0 358 300"
    role="img"
    aria-label="あなたを中心に、授業・学部学科・趣味の共通点で他の学生とつながる図"
    className="h-auto w-full max-w-[358px]"
  >
    <g className="stroke-line-strong" fill="none" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round">
      <path d="M179 150 L72 64" />
      <path d="M179 150 L292 74" />
      <path d="M179 150 L179 252" />
      <path d="M72 64 L24 24" />
      <path d="M72 64 L30 112" />
      <path d="M292 74 L336 30" />
      <path d="M292 74 L334 128" />
      <path d="M179 252 L112 282" />
      <path d="M179 252 L246 282" />
    </g>
    <circle cx="24" cy="24" r="12" className="fill-accent-sun" />
    <circle cx="30" cy="112" r="10" className="fill-accent-pink" />
    <circle cx="336" cy="30" r="10" className="fill-trust" />
    <circle cx="334" cy="128" r="12" className="fill-accent-sun" />
    <circle cx="112" cy="282" r="12" className="fill-accent-pink" />
    <circle cx="246" cy="282" r="10" className="fill-trust" />
    {[
      { x: 32, y: 44, w: 80, label: "授業" },
      { x: 236, y: 54, w: 112, label: "学部・学科" },
      { x: 139, y: 232, w: 80, label: "趣味" },
    ].map((node) => (
      <g key={node.label}>
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height="40"
          rx="20"
          className="fill-surface-raised stroke-line-strong"
          strokeWidth="2"
        />
        <text
          x={node.x + node.w / 2}
          y={node.y + 25}
          textAnchor="middle"
          className="fill-ink text-sm font-bold"
        >
          {node.label}
        </text>
      </g>
    ))}
    <circle cx="179" cy="150" r="44" className="fill-brand" />
    <text x="179" y="156" textAnchor="middle" className="fill-on-brand text-base font-black">
      あなた
    </text>
  </svg>
);

/* ------------------------------------------------------------------ *
 * ページ本体
 * ------------------------------------------------------------------ */

/**
 * 未ログイン時の入口 (LP)。
 * パスワードは持たず、大学のメールアドレスに magic link を送るだけなので、
 * 登録とログインは同じフォームで済む。フォームはファーストビューの白いシートに置く。
 */
export const Landing = () => {
  const { data: session, isPending } = useSession();
  const [localPart, setLocalPart] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!isPending && session) {
    return <Navigate to="/timeline" replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (localPart.trim() === "") return;

    setSending(true);
    const email = `${localPart.trim()}@${universityEmailDomain}`;
    const { error } = await sendMagicLink(email, "/#/timeline");
    setSending(false);

    if (error) {
      toast.error(error.message ?? "ログインリンクの送信に失敗しました");
      return;
    }
    setSent(true);
  };

  return (
    <div className="bg-background text-foreground">
      {/* 1. ファーストビュー */}
      <header className="bg-primary text-primary-foreground overflow-hidden rounded-b-[32px] px-4 pb-[clamp(40px,6vw,80px)]">
        <div className="mx-auto flex min-h-18 max-w-[1120px] items-center justify-between gap-4">
          <p className="flex items-center gap-2">
            <img src={icon} alt="" className="bg-surface size-9 rounded-full p-1" />
            <Wordmark onBrand className="text-[22px]" />
          </p>
          <Button variant="ink" size="sm" onClick={focusLoginForm}>
            登録・ログイン
          </Button>
        </div>

        <div className="mx-auto mt-[clamp(16px,4vw,48px)] flex max-w-[1120px] flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
            <Eyebrow className="text-on-brand">FOR HOSEI STUDENTS ONLY</Eyebrow>
            <h1 className="text-[clamp(34px,5vw,58px)] leading-[1.28] font-black tracking-[-0.01em] text-balance">
              同じ授業を受けているのに、話したことがない。
            </h1>
            <p className="text-[clamp(18px,2vw,22px)] leading-[1.6] font-bold">
              そんな大学生活に、新しいつながりを。
            </p>

            <div className="bg-surface text-foreground mt-4 flex max-w-[520px] flex-col gap-4 rounded-2xl p-6 shadow-sheet">
              <p>法政大学生だけが使える、授業の情報と学生の声が集まる学内限定SNSです。</p>

              {sent ? (
                <div className="space-y-3">
                  <Notice variant="done">
                    ログイン用のリンクをメールで送りました。メールを開いてリンクを押してください。
                  </Notice>
                  <p className="text-muted-foreground text-xs leading-[18px]">
                    リンクの有効期限は10分です。届かない場合は迷惑メールもご確認ください。
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                    別のアドレスで試す
                  </Button>
                </div>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={submit}>
                  <div className="grid gap-1">
                    <Label htmlFor={EMAIL_INPUT_ID}>大学のメールアドレス</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={EMAIL_INPUT_ID}
                        autoComplete="username"
                        value={localPart}
                        onChange={(event) => setLocalPart(event.target.value)}
                        placeholder="taro.hosei.0a"
                        required
                      />
                      <span className="text-muted-foreground shrink-0 text-sm">
                        @{universityEmailDomain}
                      </span>
                    </div>
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={sending}>
                    {sending ? "送信中..." : "登録・ログインのリンクを送る"}
                  </Button>
                  <p className="text-muted-foreground text-xs leading-[18px]">
                    ※学内メールアドレスでの認証が必要です。パスワードは不要です。
                  </p>
                </form>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-[1_1_320px] justify-center">
            <div className="relative h-[470px] w-[320px] max-w-full">
              <div aria-hidden className="bg-accent-sun absolute top-6 left-0 size-24 rounded-full" />
              <div aria-hidden className="bg-accent-pink absolute right-0 bottom-10 size-30 rounded-full" />
              <div aria-hidden className="bg-trust absolute top-0 right-3 size-10 rounded-full" />
              <PhoneFrame
                className="absolute top-4 left-1/2 w-62 -translate-x-1/2"
                title={
                  <>
                    <Wordmark className="text-base" />
                    <Search className="size-5" />
                  </>
                }
              >
                <div className="flex gap-1.5">
                  <span className="border-brand-strong bg-brand-tint text-brand-strong rounded-full border-2 px-3 text-xs leading-[18px] font-bold">
                    授業
                  </span>
                  <span className="bg-surface-raised rounded-full border-2 border-input px-3 text-xs leading-[18px] font-bold">
                    学部・学科
                  </span>
                </div>
                <MockCard>
                  <div className="mb-1 flex gap-1.5">
                    <span className="bg-muted text-muted-foreground rounded-[6px] px-1.5 text-[11px] leading-4">
                      月2限
                    </span>
                    <span className="bg-muted text-muted-foreground rounded-[6px] px-1.5 text-[11px] leading-4">
                      全学共通
                    </span>
                  </div>
                  <p className="text-sm leading-5 font-bold">サンプル科目A</p>
                  <p className="text-muted-foreground text-xs leading-[18px]">受講者の声 12件</p>
                  <p className="mt-1 text-[13px] leading-[18px] font-bold">総合 ★★★★☆ 4.0</p>
                </MockCard>
                <MockPost char="は" name="はなこ" avatar="bg-accent-sun">
                  期末は過去問と形式が同じでした。範囲は第8回まで。
                </MockPost>
                <MockCourse name="サンプル科目B" voices={8} />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* 2. 共感 */}
        <section className="bg-muted px-4 py-[clamp(56px,8vw,96px)]">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-start gap-12">
            <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-4">
              <Eyebrow>PROBLEM</Eyebrow>
              <SectionTitle>同じ教室にいても、話すきっかけがない。</SectionTitle>
              <p className="text-muted-foreground mt-2 text-sm leading-5 font-bold">
                こんなこと、ありませんか？
              </p>
              <div className="flex flex-col gap-3">
                {VOICES.map((voice, index) => (
                  <p
                    key={voice}
                    className={cn(
                      "bg-card max-w-80 border px-[18px] py-3 font-bold",
                      index % 2 === 0
                        ? "self-start rounded-[24px_24px_24px_8px]"
                        : "self-end rounded-[24px_24px_8px_24px]",
                    )}
                  >
                    {voice}
                  </p>
                ))}
              </div>
            </div>

            <div className="bg-card flex min-w-0 flex-[1_1_400px] flex-col gap-4 rounded-2xl border p-6">
              <h3 className="text-lg leading-[26px] font-bold">学生の人間関係に関するアンケート</h3>
              <SurveyBar label="学部・学科外の人との交流がない" value={31} />
              <SurveyBar label="同じ授業を受けている人とほとんど話さない" value={25} />
              <SurveyBar label="サークル以外のつながりが少ない" value={19} />
              <SurveyBar label="特に困っていない" value={34} muted />
              <p className="text-muted-foreground text-xs leading-[18px]">{SURVEY_NOTE}</p>
            </div>
          </div>
        </section>

        {/* 3. 仕組み */}
        <section className="px-4 py-[clamp(56px,8vw,96px)]">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-12">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
              <Eyebrow>HOW IT WORKS</Eyebrow>
              <SectionTitle>共通点が、話すきっかけになる。</SectionTitle>
              <p className="text-muted-foreground">
                同じ授業、同じ学部・学科、同じ趣味。Hosei
                Linkは、まだ話したことのない学生同士を、共通点からつなぎます。
              </p>
              <p className="text-muted-foreground text-xs leading-[18px]">
                ※趣味でのつながりは今後対応予定です。
              </p>
            </div>
            <div className="flex min-w-0 flex-[1_1_360px] justify-center">
              <ConnectionDiagram />
            </div>
          </div>
        </section>

        {/* 4. 機能 */}
        <section className="bg-muted px-4 py-[clamp(56px,8vw,96px)]">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Eyebrow>FEATURES</Eyebrow>
              <SectionTitle>大学生活が、ちょっと楽になる。</SectionTitle>
            </div>

            <div className="flex flex-wrap gap-4">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="bg-card flex min-w-0 flex-[1_1_340px] items-start gap-4 rounded-lg border p-5 shadow-card"
                >
                  <span className="bg-brand-tint text-brand-strong grid size-12 shrink-0 place-items-center rounded-lg">
                    <feature.icon className="size-6" aria-hidden />
                  </span>
                  <div className="flex flex-col gap-1">
                    <Badge variant={feature.available ? "trust" : "soon"}>
                      {feature.available ? "提供中" : "今後対応予定"}
                    </Badge>
                    <h3 className="text-lg leading-[26px] font-bold">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-[22px]">{feature.body}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="bg-card flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border px-6 py-5">
              <p className="flex-[1_1_260px] text-sm leading-[22px] font-bold">
                アンケートで「欲しい機能」として多かった声
              </p>
              <div className="flex-[1_1_200px]">
                <SurveyBar label="授業の評価を共有する機能" value={65} />
              </div>
              <div className="flex-[1_1_200px]">
                <SurveyBar label="同じ授業の学生同士の交流" value={54} />
              </div>
              <p className="text-muted-foreground basis-full text-xs leading-[18px]">
                {SURVEY_NOTE}
              </p>
            </div>
          </div>
        </section>

        {/* 5. 安全性 */}
        <section className="px-4 py-[clamp(56px,8vw,96px)]">
          <div className="bg-trust-tint mx-auto flex max-w-[1120px] flex-wrap gap-10 rounded-[32px] p-[clamp(24px,4vw,56px)]">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-6">
              <div className="flex flex-col gap-3">
                <Eyebrow className="text-trust-strong">SAFETY</Eyebrow>
                <SectionTitle className="text-trust-strong">安心して使うための仕組み</SectionTitle>
              </div>
              {SAFETY.map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <span className="bg-trust text-on-trust grid size-11 shrink-0 place-items-center rounded-full">
                    <item.icon className="size-[22px]" aria-hidden />
                  </span>
                  <div>
                    <h3 className="mb-1 text-lg leading-[26px] font-bold">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-[22px]">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card flex min-w-0 flex-[1_1_340px] flex-col gap-4 self-center rounded-2xl p-6">
              <p className="text-sm leading-[22px] font-bold">法政大学生限定の仕組みについて</p>
              <p className="flex items-baseline gap-2">
                <span className="text-trust-strong text-[56px] leading-none font-black">91%</span>
                <span className="text-sm leading-[22px]">が「安心できる」と回答</span>
              </p>
              <div
                role="img"
                aria-label="91%"
                className="bg-muted h-3 overflow-hidden rounded-full border border-input"
              >
                <div className="bg-trust h-full w-[91%]" />
              </div>
              <p className="text-muted-foreground text-sm leading-[22px]">
                一方で、誤情報・デマの拡散（65%）、個人情報の流出（59%）、荒らし行為・誹謗中傷（59%）への不安の声もありました。こうした声を受け止めて、仕組みを改善していきます。
              </p>
              <p className="text-muted-foreground text-xs leading-[18px]">
                {SURVEY_NOTE}
                「安心できる」は「とても安心できる」「ある程度安心できる」の合計。
              </p>
            </div>
          </div>
        </section>

        {/* 6. 利用シーン */}
        <section className="bg-muted px-4 py-[clamp(56px,8vw,96px)]">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-10">
            <div className="flex flex-col items-center gap-3 text-center">
              <Eyebrow>SCENES</Eyebrow>
              <SectionTitle>こんなときに、使えます。</SectionTitle>
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-10">
              {[
                {
                  title: "履修を決める前に",
                  body: "気になる授業の評価や、課題の量を確認。",
                  phone: (
                    <PhoneFrame title="授業">
                      <MockCourse name="サンプル科目A" voices={12} rating="★★★★☆ 4.0" workload="やや多い" />
                      <MockCourse name="サンプル科目B" voices={8} rating="★★★☆☆ 3.2" workload="ふつう" />
                      <MockCourse name="サンプル科目C" voices={5} />
                    </PhoneFrame>
                  ),
                },
                {
                  title: "課題や試験の前に",
                  body: "同じ授業の学生に、範囲や形式を聞ける。",
                  phone: (
                    <PhoneFrame title="サンプル科目A">
                      <MockPost char="た" name="たろう" avatar="bg-accent-pink">
                        来週のレポート、文字数の指定ってありましたか？
                      </MockPost>
                      <MockPost char="は" name="はなこ" avatar="bg-accent-sun">
                        2000字以上と、授業資料に書いてありました。
                      </MockPost>
                      <p className="text-danger flex items-center gap-1.5 px-1 text-xs leading-[18px] font-bold">
                        <Flag className="size-4" />
                        各投稿から通報できます
                      </p>
                    </PhoneFrame>
                  ),
                },
                {
                  title: "授業のあとで",
                  body: "同じ授業を登録している学生とつながる。",
                  phone: (
                    <PhoneFrame title="この授業の学生">
                      <p className="text-muted-foreground text-xs leading-[18px]">
                        サンプル科目A を登録している学生
                      </p>
                      <MockMember char="は" name="はなこ" avatar="bg-accent-sun" />
                      <MockMember char="た" name="たろう" avatar="bg-accent-pink" />
                      <MockMember char="ゆ" name="ゆい" avatar="bg-trust-tint text-trust-strong" />
                    </PhoneFrame>
                  ),
                },
              ].map((scene, index) => (
                <div
                  key={scene.title}
                  className="flex max-w-[360px] flex-[1_1_300px] flex-col items-center gap-5"
                >
                  <div className="flex items-start gap-3 self-stretch">
                    <span className="bg-trust text-on-trust grid size-8 shrink-0 place-items-center rounded-full font-black">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg leading-[26px] font-bold">{scene.title}</h3>
                      <p className="text-muted-foreground mt-1 text-sm leading-[22px]">
                        {scene.body}
                      </p>
                    </div>
                  </div>
                  {scene.phone}
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-center text-xs leading-[18px]">
              ※画面はイメージです。
            </p>
          </div>
        </section>

        {/* 7. CTA */}
        <section className="px-4 py-[clamp(56px,8vw,96px)]">
          <div className="bg-primary text-primary-foreground mx-auto flex max-w-[880px] flex-col items-center gap-5 rounded-[32px] px-[clamp(24px,5vw,64px)] py-[clamp(32px,5vw,64px)] text-center">
            <Eyebrow className="text-on-brand">JOIN</Eyebrow>
            <h2 className="text-[clamp(26px,3.6vw,40px)] leading-[1.35] font-black text-balance">
              共通点から、大学生活を広げよう。
            </h2>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-bold">
              {[
                "授業の評価や感想が読める",
                "同じ授業の学生と情報交換できる",
                "学内限定。通報・ブロックもできる",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-5" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Button variant="ink" size="lg" className="w-full max-w-[360px]" onClick={focusLoginForm}>
              登録してはじめる
            </Button>
            <p className="text-xs leading-[18px]">※学内メールアドレスでの認証が必要です</p>
          </div>
        </section>
      </main>

      {/* 8. フッター */}
      <footer className="bg-muted text-muted-foreground px-4 py-10 text-sm leading-[22px]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-1">
          <Wordmark />
          <p>運営：冨永紅輝</p>
        </div>
        <div className="mx-auto mt-6 flex max-w-[1120px] flex-wrap justify-between gap-x-6 gap-y-2 border-t pt-4 text-xs leading-[18px]">
          <p>本サービスは法政大学の公式サービスではありません。</p>
          <p>© 2026 Hosei Link</p>
        </div>
      </footer>
    </div>
  );
};
