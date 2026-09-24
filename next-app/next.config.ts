import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "jsonwebtoken",
    "bcryptjs",
    "nodemailer",
    "sanitize-html",
  ],
};

export default nextConfig;
