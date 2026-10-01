import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/** Image de partage (réseaux sociaux, messageries) : un titre sur le fond du site. */
export function ogCard({ title, subtitle }: { title: string; subtitle: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0b1a2b 0%, #1b3a5a 100%)",
          color: "#e8f1fa",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#f2c14e", letterSpacing: 2 }}>
          {SITE_NAME.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 38, color: "#9db2c8" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", height: 14, width: 220, background: "#d7263d", borderRadius: 7 }} />
      </div>
    ),
    OG_SIZE,
  );
}
