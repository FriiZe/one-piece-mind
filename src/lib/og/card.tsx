import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/** Les polices du site (Bangers, Nunito), lues une fois : sans elles, l'image retombe sur une police neutre. */
const font = (file: string) => readFile(join(process.cwd(), "src/lib/og/fonts", file));
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    font("bangers-latin-400-normal.woff").then((data) => ({ name: "Bangers", data, weight: 400 as const, style: "normal" as const })),
    font("nunito-latin-400-normal.woff").then((data) => ({ name: "Nunito", data, weight: 400 as const, style: "normal" as const })),
    font("nunito-latin-700-normal.woff").then((data) => ({ name: "Nunito", data, weight: 700 as const, style: "normal" as const })),
    font("nunito-latin-800-normal.woff").then((data) => ({ name: "Nunito", data, weight: 800 as const, style: "normal" as const })),
  ]);
  return fonts;
}

const PROMISES = ["Gratuit", "Sans inscription", "Sans spoiler"];

export type OgCard = {
  /** Un saut de ligne (« \n ») impose la coupure du titre. */
  title: string;
  subtitle: string;
  /** Petite ligne au-dessus du titre : la catégorie du jeu, par exemple. */
  eyebrow?: string;
  /** Couleurs de la pastille : fond et texte. Par défaut, le jaune paille du site. */
  tone?: { background: string; color: string };
  /** Ce qu'on voit à la place du portrait sur l'avis de recherche : une initiale, un point d'interrogation. */
  mark: string;
  /** La « prime » de l'avis : ce que le jeu rapporte, ou le nombre de jeux. */
  bounty: string;
};

/**
 * Image de partage (Discord, réseaux sociaux, messageries) : le titre à gauche,
 * un avis de recherche à droite, dans les couleurs et les polices du site.
 */
export async function ogCard({ title, subtitle, eyebrow, tone = { background: "#3a2f12", color: "#f2c14e" }, mark, bounty }: OgCard) {
  // Un titre long garde sa place : il rapetisse au lieu de pousser le reste hors du cadre
  const lines = title.split("\n");
  const longest = Math.max(...lines.map((line) => line.length));
  const titleSize = longest <= 11 ? 132 : longest <= 17 ? 108 : longest <= 20 ? 90 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#0b1a2b",
          backgroundImage: "radial-gradient(circle at 88% 8%, #2a5380 0%, #12283f 38%, #0b1a2b 70%)",
          color: "#e8f1fa",
          fontFamily: "Nunito",
        }}
      >
        {/* La houle, en bas de l'image */}
        <div style={{ position: "absolute", left: -120, bottom: -500, width: 900, height: 600, borderRadius: 450, background: "#12283f", display: "flex" }} />
        <div style={{ position: "absolute", left: 420, bottom: -540, width: 1000, height: 620, borderRadius: 500, background: "#0f2236", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 760, padding: "56px 0 56px 64px" }}>
          <div style={{ display: "flex", fontFamily: "Bangers", fontSize: 46, letterSpacing: 2, color: "#f2c14e" }}>{SITE_NAME}</div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {eyebrow && (
              <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: tone.color, marginRight: 12 }} />
                <div style={{ display: "flex", fontSize: 25, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", color: tone.color }}>
                  {eyebrow}
                </div>
              </div>
            )}
            {lines.map((line) => (
              <div key={line} style={{ display: "flex", fontFamily: "Bangers", fontSize: titleSize, lineHeight: 0.98, letterSpacing: 1 }}>
                {line}
              </div>
            ))}
            <div style={{ display: "flex", marginTop: 18, fontSize: 33, lineHeight: 1.3, color: "#9db2c8" }}>{subtitle}</div>
          </div>

          <div style={{ display: "flex" }}>
            {PROMISES.map((promise) => (
              <div
                key={promise}
                style={{
                  display: "flex",
                  marginRight: 14,
                  padding: "9px 20px",
                  borderRadius: 999,
                  border: "2px solid #2a5380",
                  background: "#12283f",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {promise}
              </div>
            ))}
          </div>
        </div>

        {/* L'avis de recherche */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 330,
              padding: "18px 24px 22px",
              background: "#f6ecd6",
              border: "10px solid #e3d2a9",
              borderRadius: 14,
              color: "#2b2118",
              transform: "rotate(4deg)",
              boxShadow: "0 30px 60px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Bangers", fontSize: 70, lineHeight: 1, letterSpacing: 9 }}>WANTED</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 218,
                marginTop: 10,
                background: tone.background,
                color: tone.color,
                fontFamily: "Bangers",
                fontSize: 190,
                lineHeight: 1,
              }}
            >
              {mark}
            </div>
            <div style={{ display: "flex", marginTop: 12, fontSize: 17, fontWeight: 800, letterSpacing: 6 }}>DEAD OR ALIVE</div>
            <div style={{ display: "flex", marginTop: 2, fontFamily: "Bangers", fontSize: 50, lineHeight: 1.1, letterSpacing: 1 }}>{bounty}</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
