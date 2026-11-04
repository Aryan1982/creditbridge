import type { NextConfig } from "next";

// In development the FastAPI app runs separately on :8000 (uvicorn api.index:app).
// In production, Vercel routes /api/* to the Python function in api/index.py.
const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory would otherwise be picked as the workspace root.
  turbopack: { root: __dirname },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
