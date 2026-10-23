import { LogOut, User } from "lucide-react";
import { LogoutForm } from "@/components/auth/logout-button";
import { AiAvatar } from "@/components/ui/ai-avatar";
import { buttonClass, IconButton } from "@/components/ui/button";

type Props = {
  assistantName: string;
  onTalkToHuman: () => void;
  /** แสดงปุ่มออกจากระบบ — เฉพาะมือถือ (คอมอยู่ที่แถบร้าน) */
  canLogout?: boolean;
};

/**
 * มือถือ = แคปซูลลอย (Mobile-Chat) · คอม = แถบบนของกล่องแชต (Main)
 * ปุ่ม "คุยกับคนจริง" ต้องมีทุกจอแชต (HANDOFF §6)
 */
export function ChatHeader({ assistantName, onTalkToHuman, canLogout }: Props) {
  return (
    <header className="glass-pill mx-3 mt-3 flex shrink-0 items-center gap-2.5 py-2 pr-2 pl-2.5 md:mx-0 md:mt-0 md:gap-3 md:rounded-none md:border-0 md:border-b md:border-[rgba(230,222,245,0.9)] md:bg-transparent md:px-[18px] md:py-3.5 md:shadow-none md:backdrop-blur-none">
      <AiAvatar variant="header" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] leading-[1.4] font-semibold md:text-base">{assistantName}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden="true" className="hidden size-[7px] rounded-full bg-accent md:inline-block" />
          ออนไลน์ · พิมพ์หรือกดไมค์พูดได้
        </span>
      </div>
      <button
        type="button"
        onClick={onTalkToHuman}
        className={buttonClass("white", "size-11 shrink-0 p-0 text-sm md:w-auto md:px-4")}
      >
        <User aria-hidden="true" size={18} className="text-accent" />
        <span className="sr-only md:not-sr-only">คุยกับคนจริง</span>
      </button>
      {canLogout && (
        <LogoutForm className="md:hidden">
          <IconButton type="submit" label="ออกจากระบบ" variant="ghost">
            <LogOut aria-hidden="true" size={18} />
          </IconButton>
        </LogoutForm>
      )}
    </header>
  );
}
