"use client";

import { useMemo } from "react";
import type { ApprovalProduct, OwnerChatView } from "@/lib/owner/chat-view";
import { connectChat } from "@/lib/supabase/live";
import { OwnerChatScreen, type OwnerChatAction, type OwnerChatTransport } from "./owner-chat";

async function call(chatId: string, action?: OwnerChatAction): Promise<OwnerChatView> {
  const res = await fetch(`/api/owner/chats/${encodeURIComponent(chatId)}`, {
    method: action ? "POST" : "GET",
    headers: action ? { "content-type": "application/json" } : undefined,
    body: action ? JSON.stringify(action) : undefined,
  });
  if (!res.ok) throw new Error(`owner chat ${res.status}`);
  return (await res.json()) as OwnerChatView;
}

/** ต่อหน้าแชตเถ้าแก่เข้ากับ API + Realtime จริง (ฟังก์ชันส่งผ่าน props จาก server ไม่ได้) */
export function OwnerChatFromServer({
  initial,
  ownerName,
  voiceInput,
  approvalProducts,
}: {
  initial: OwnerChatView;
  ownerName: string;
  voiceInput: boolean;
  approvalProducts?: ApprovalProduct[];
}) {
  const { chatId } = initial;
  const transport = useMemo<OwnerChatTransport>(
    () => ({ act: (action) => call(chatId, action), load: () => call(chatId) }),
    [chatId],
  );
  const connect = useMemo(() => connectChat(chatId), [chatId]);
  return (
    <OwnerChatScreen
      initial={initial}
      ownerName={ownerName}
      transport={transport}
      connect={connect}
      voiceInput={voiceInput}
      approvalProducts={approvalProducts}
    />
  );
}
