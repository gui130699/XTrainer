import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./assessment.css";
import "./training-methods.css";
import "./workout-plans.css";
import "./workout-builder.css";
import { Providers } from "@/components/providers";
import { InstallAppButton } from "@/components/install-app-button";
const basePath = process.env.GITHUB_ACTIONS === "true" ? "/XTrainer" : "";
const buildVersion = process.env.GITHUB_SHA ?? "local";
const versioned = (path: string) => `${basePath}${path}?v=${buildVersion}`;
export const metadata: Metadata = { title:"XTrainer", description:"Seu treino, sua evolução.", manifest:versioned("/manifest.webmanifest"), icons:{icon:[{url:versioned("/xtrainer-user-icon-192.png"),sizes:"192x192",type:"image/png"},{url:versioned("/xtrainer-user-icon-512.png"),sizes:"512x512",type:"image/png"}],shortcut:versioned("/xtrainer-user-icon-192.png"),apple:{url:versioned("/xtrainer-user-icon-192.png"),sizes:"192x192",type:"image/png"}}, appleWebApp:{capable:true,title:"XTrainer",statusBarStyle:"black-translucent"} };
export const viewport: Viewport = { themeColor:"#0b5ea8" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers><InstallAppButton/>{children}</Providers></body></html>; }
