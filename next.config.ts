import type { NextConfig } from "next";
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath: isGitHubPages ? "/XTrainer" : "",
  assetPrefix: isGitHubPages ? "/XTrainer/" : undefined,
};
export default nextConfig;
