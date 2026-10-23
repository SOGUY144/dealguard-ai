"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { ChatAction, ChatView } from "@/lib/chat/actions";
import { mergeServerView, selectOffer, withPendingBuyerText, withSendError } from "@/lib/chat/live-view";
import { initialChatState, mockRespond, type MockContext } from "@/lib/chat/mock-responder";
import { buildScenario, type ScenarioName } from "@/lib/chat/scenarios";
import { fetchChatTransport, fetchChatView, UnauthorizedError, type ChatTransport } from "@/lib/chat/transport";
import { connectChat } from "@/lib/supabase/live";
import { type ConnectLive, useLiveUpdates } from "@/components/live/use-live-updates";

export type LiveChat = {
  initialView: ChatView;
  transport?: ChatTransport;
  /** ฟังข้อความใหม่ของแชตนี้ (ไม่ใส่ = Realtime ของ Supabase · null = ไม่ฟัง เช่นใน test) */
  connect?: ConnectLive | null;
  reload?: () => Promise<ChatView>;
};

type Options = {
  /** มี = แชตจริงผ่าน API · ไม่มี = ตัวตอบจำลอง (ตรวจหน้าตา / test) */
  live?: LiveChat;
  scenario?: ScenarioName;
  mockContext: MockContext;
  /** server ชี้ข้อเสนอให้ (เช่น ลูกค้าพิมพ์ "สั่ง 1,500 ชิ้น") */
  onFocus: (messageId: string) => void;
};

/**
 * สถานะแชตของหน้าจอ — dispatch คืน false เมื่อส่งไม่ได้/ไม่สำเร็จ (ช่องพิมพ์จะคืนข้อความให้)
 * แชตจริงส่งได้ทีละคำขอ กันลูกค้ากดซ้ำระหว่างรอ
 */
export function useChatSession({ live, scenario, mockContext, onFocus }: Options) {
  const [mock, setMock] = useState(() =>
    live ? null : scenario ? buildScenario(scenario, mockContext) : initialChatState(mockContext),
  );
  const [liveView, setLiveView] = useState(live?.initialView);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const router = useRouter();

  const view: ChatView = live && liveView ? liveView : mock!;

  // เถ้าแก่ตอบ / ให้ AI ตอบต่อ → ลูกค้าเห็นเองโดยไม่ต้องรีเฟรช
  const chatId = live?.initialView.chatId;
  const connect = useMemo(
    () => (live === undefined ? null : live.connect !== undefined ? live.connect : chatId ? connectChat(chatId) : null),
    [live, chatId],
  );
  const reload = live?.reload ?? fetchChatView;
  useLiveUpdates(connect, () => {
    // กำลังรอคำตอบของตัวเองอยู่ — คำตอบนั้นจะพาข้อความล่าสุดมาเอง
    if (inFlight.current) return;
    reload().then((next) => setLiveView((v) => (v ? mergeServerView(v, next) : next)), () => {});
  });

  async function dispatch(action: ChatAction): Promise<boolean> {
    if (!live) {
      setMock((state) => mockRespond(state!, action, mockContext));
      return true;
    }
    if (action.type === "select_offer") {
      setLiveView((v) => v && selectOffer(v, action.messageId, action.offerId));
      return true;
    }
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    // chip ก่อนส่ง — ส่งไม่สำเร็จแล้วให้กลับมา
    const chipsBefore = liveView?.suggestions ?? [];
    if (action.type === "send") {
      const at = new Date().toISOString();
      setLiveView((v) => v && withPendingBuyerText(v, action.text.trim(), action.inputMode, at));
    }
    try {
      const next = await (live.transport ?? fetchChatTransport)(action);
      setLiveView((v) => (v ? mergeServerView(v, next) : next));
      if (next.focus) onFocus(next.focus.messageId);
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.push("/login?next=%2F");
        return false;
      }
      console.error("[chat]", err);
      const at = new Date().toISOString();
      setLiveView((v) => v && withSendError(v, at, chipsBefore));
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { view, pending, dispatch };
}
