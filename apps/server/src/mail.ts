import { projectName } from "./constants";
import type { Bindings } from "./env";

/**
 * Cloudflare Email Sending によるメール送信。
 *
 * 旧実装は nodemailer の SMTP 直叩きだったが、Workers には TCP ソケットがないので
 * 動かない。Email Service のバインディング (env.EMAIL) を使えば
 * API キーもシークレット管理も不要で、Worker から直接送れる。
 *
 * 前提:
 *   - Workers 有料プラン (Email Sending の要件)
 *   - 送信元ドメインが Cloudflare で認証済みであること
 *   - wrangler.jsonc の send_email バインディング
 *
 * 注意: send_email に destination_address / allowed_destination_addresses を
 * 設定すると宛先がそのアドレスに限定される。magic link は任意の学生宛に
 * 送る必要があるので、意図的にどちらも設定していない。
 */

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export const sendMail = async (
  env: Bindings,
  { to, subject, text, html }: MailInput,
): Promise<void> => {
  await env.EMAIL.send({
    to,
    from: { email: env.MAIL_FROM, name: projectName },
    subject,
    text,
    html,
  });
};
