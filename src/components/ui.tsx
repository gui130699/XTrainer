"use client";
import { LoaderCircle } from "lucide-react";
export function Button({children,className="",...props}:React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`button ${className}`} {...props}>{children}</button>; }
export function Card({children,className=""}:{children:React.ReactNode;className?:string}) { return <section className={`card ${className}`}>{children}</section>; }
export function Empty({title,detail}:{title:string;detail:string}) { return <div className="empty"><strong>{title}</strong><span>{detail}</span></div>; }
export function Loading(){return <div className="loading"><LoaderCircle className="spin"/> Carregando</div>}
