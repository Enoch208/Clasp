import { ImageResponse } from "next/og";

export const alt = "Clasp — Connect apps to Fiber wallets. Never hand over the keys.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f2f4f6",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: "#5BA4FF",
              border: "3px solid #0B0B0E",
              boxShadow: "5px 5px 0 #0B0B0E",
            }}
          />
          <div style={{ display: "flex", fontSize: "34px", fontWeight: 800, color: "#0B0B0E" }}>Clasp</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "88px",
              fontWeight: 900,
              color: "#0B0B0E",
              letterSpacing: "-0.045em",
              lineHeight: 1,
            }}
          >
            Never hand over the keys.
          </div>
          <div style={{ display: "flex", fontSize: "34px", fontWeight: 600, color: "#5E5A52", maxWidth: "980px" }}>
            The secure app-to-wallet session layer for Fiber — limited, user-edited, time-boxed, revocable authority.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: "#0B0B0E" }}>useclasp.xyz</div>
          <div
            style={{
              display: "flex",
              padding: "10px 18px",
              background: "#FFCC33",
              border: "2px solid #0B0B0E",
              fontSize: "24px",
              fontWeight: 800,
              color: "#0B0B0E",
            }}
          >
            Fiber Network · Category 1
          </div>
        </div>
      </div>
    ),
    size,
  );
}
