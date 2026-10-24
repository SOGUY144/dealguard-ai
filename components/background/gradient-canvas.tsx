"use client";

// ตัววาดพื้นหลังเคลื่อนไหว — โหลดเฉพาะตอน MovingBackground ตัดสินใจเปิด (three.js อยู่ในไฟล์นี้เท่านั้น)
// สีเดียวกับ mesh ใน design/tokens.css (ชมพู / ลาเวนเดอร์ / ฟ้า) ขยับช้าๆ ให้กระจกและตัวหนังสือยังอ่านง่าย
// lightType "3d" = ไม่โหลดไฟล์แสงจากเว็บอื่น
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

export function GradientCanvas() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 animate-[bg-fade_1.6s_ease-out]">
      <ShaderGradientCanvas pixelDensity={1} fov={45} pointerEvents="none" lazyLoad={false} style={{ position: "absolute", inset: 0 }}>
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          uSpeed={0.06}
          uStrength={1.2}
          uDensity={1.1}
          uFrequency={5.5}
          uAmplitude={0}
          color1="#FBE4EF"
          color2="#E4DAFB"
          color3="#DCE5FF"
          lightType="3d"
          brightness={1.3}
          reflection={0.1}
          grain="off"
          cAzimuthAngle={180}
          cPolarAngle={80}
          cDistance={2.8}
          cameraZoom={9.1}
          positionX={0}
          positionY={0}
          positionZ={0}
          rotationX={50}
          rotationY={0}
          rotationZ={-60}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
