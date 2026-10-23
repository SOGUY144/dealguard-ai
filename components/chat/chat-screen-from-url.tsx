"use client";

import { useSearchParams } from "next/navigation";
import { isScenario } from "@/lib/chat/scenarios";
import { ChatScreen } from "./chat-screen";

type Props = Omit<Parameters<typeof ChatScreen>[0], "scenario">;

/** อ่าน ?state=<ชื่อ> เพื่อเปิดดูแต่ละจอในดีไซน์ — ต้องอยู่ใน <Suspense> (ดู useSearchParams ของ Next 16) */
export function ChatScreenFromUrl(props: Props) {
  const state = useSearchParams().get("state");
  // key: เปลี่ยน state ใน URL แล้วเริ่มแชตใหม่
  return <ChatScreen key={state ?? "live"} {...props} scenario={isScenario(state) ? state : undefined} />;
}
