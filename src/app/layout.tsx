import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./training-methods.css";
import { Providers } from "@/components/providers";
import { InstallAppButton } from "@/components/install-app-button";
const basePath = process.env.GITHUB_ACTIONS === "true" ? "/XTrainer" : "";
export const metadata: Metadata = { title:"XTrainer", description:"Seu treino, sua evolução.", manifest:`${basePath}/manifest.webmanifest`, icons:{icon:[{url:`${basePath}/xtrainer-user-icon-192.png`,sizes:"192x192",type:"image/png"},{url:`${basePath}/xtrainer-user-icon-512.png`,sizes:"512x512",type:"image/png"}],apple:{url:`${basePath}/xtrainer-user-icon-192.png`,sizes:"192x192",type:"image/png"}}, appleWebApp:{capable:true,title:"XTrainer",statusBarStyle:"black-translucent"} };
export const viewport: Viewport = { themeColor:"#0b5ea8" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers><InstallAppButton/>{children}</Providers></body></html>; }
