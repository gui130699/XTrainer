import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata: Metadata = { title:"XTrainer", description:"Seu treino, sua evolução.", manifest:"/manifest.webmanifest", appleWebApp:{capable:true,title:"XTrainer"} };
export const viewport: Viewport = { themeColor:"#8b5cf6" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
