import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorkHub",
    short_name: "WorkHub",
    description: "Personal work tracker: initiatives with a running log.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf9f0",
    theme_color: "#b44e2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
