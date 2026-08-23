"use client";
import { LoaderCircle } from "lucide-react";
export function Button({children,className="",...props}:React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`button ${className}`} {...props}>{children}</button>; }
export function Card({children,className=""}:{children:React.ReactNode;className?:string}) { return <section className={`card ${className}`}>{children}</section>; }
export function MetricCard({icon:Icon,label,value,detail,className=""}:{icon?:React.ComponentType<{size?:number}>;label:string;value:React.ReactNode;detail?:React.ReactNode;className?:string}) {
  return <section className={`card metric-card ${className}`}>
    <span className="metric-card-label">{Icon&&<Icon size={14}/>}{label}</span>
    <strong className="metric-card-value">{value}</strong>
    {detail&&<span className="metric-card-detail">{detail}</span>}
  </section>;
}
export function Empty({title,detail,icon:Icon,action}:{title:string;detail:string;icon?:React.ComponentType<{size?:number}>;action?:React.ReactNode}) { return <div className="empty">{Icon&&<Icon size={26}/>}<strong>{title}</strong><span>{detail}</span>{action}</div>; }
export function Loading(){return <div className="loading"><LoaderCircle className="spin"/> Carregando</div>}
export function ErrorState({message,onRetry}:{message:string;onRetry?:()=>void}) { return <div className="error-state" role="alert"><strong>Não foi possível carregar.</strong><span>{message}</span>{onRetry&&<button className="text-button" onClick={onRetry}>Tentar novamente</button>}</div> }
