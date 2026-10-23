// หน้าชั่วคราวของเฟส 0: เช็กว่า tokens, กระจก และฟอนต์ไทยทำงาน — เฟส 2 จะแทนด้วยหน้าแชตตาม design/screens/Main.dc.html
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pt-5 md:px-8">
      <header className="glass-pill flex items-center py-2 pr-2 pl-6">
        <div className="flex flex-col">
          <span className="text-lg font-semibold leading-[1.4]">ร้านเฮียชัยโมบาย</span>
          <span className="text-[13px] leading-[1.4] text-muted">ขายส่งอุปกรณ์มือถือ</span>
        </div>
      </header>
    </div>
  );
}
