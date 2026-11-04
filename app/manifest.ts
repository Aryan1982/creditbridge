import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CreditBridge",
    short_name: "CreditBridge",
    description: "Verified, explainable credit decisions from bank statement cash flow.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
  };
}
