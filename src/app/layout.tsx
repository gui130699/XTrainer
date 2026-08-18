import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { InstallAppButton } from "@/components/install-app-button";
const basePath = process.env.GITHUB_ACTIONS === "true" ? "/XTrainer" : "";
export const metadata: Metadata = { title:"XTrainer", description:"Seu treino, sua evolução.", manifest:`${basePath}/manifest.webmanifest`, icons:{icon:`${basePath}/icon-192.png`,apple:`${basePath}/icon-192.png`}, appleWebApp:{capable:true,title:"XTrainer",statusBarStyle:"black-translucent"} };
export const viewport: Viewport = { themeColor:"#8b5cf6" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers><InstallAppButton/>{children}</Providers></body></html>; }
