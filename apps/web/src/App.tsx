import { Navigate, Route, Routes } from "react-router";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Chat } from "@/pages/Chat";
import { ChatList } from "@/pages/ChatList";
import { ClassChat } from "@/pages/ClassChat";
import { ClassDetail } from "@/pages/ClassDetail";
import { Contact } from "@/pages/Contact";
import { FindClass } from "@/pages/FindClass";
import { Friends } from "@/pages/Friends";
import { Landing } from "@/pages/Landing";
import { PostDetail } from "@/pages/PostDetail";
import { ProfileEdit } from "@/pages/ProfileEdit";
import { ProfileSetup } from "@/pages/ProfileSetup";
import { Schedule } from "@/pages/Schedule";
import { Timeline } from "@/pages/Timeline";
import { UserProfile } from "@/pages/UserProfile";

/**
 * 宣言的ルーティング (react-router の Routes/Route)。
 * 旧 Next.js の App Router のファイル規約をここ1ファイルに集約している。
 *
 * ルーターは hash router。SPA を Worker の ASSETS バインディングから配信する際に
 * パスごとのフォールバック設定が要らなくなるため。
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* ログイン必須。初回セットアップ未完了なら /setup に足止めされる */}
      <Route element={<ProtectedLayout />}>
        {/* セットアップ中は共通ヘッダーを出さない (他の画面へ行けてしまうため) */}
        <Route path="/setup" element={<ProfileSetup />} />

        <Route element={<AppLayout />}>
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/profile" element={<ProfileEdit />} />
          <Route path="/chat" element={<ChatList />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/find" element={<FindClass />} />
          <Route path="/class/:id" element={<ClassDetail />} />
          <Route path="/class/:id/chat" element={<ClassChat />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
