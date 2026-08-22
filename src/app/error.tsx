"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return <div className="auth"><Card>
    <p className="eyebrow">ALGO DEU ERRADO</p>
    <h1>Não foi possível carregar esta tela</h1>
    <p className="muted">Isso pode ser algo temporário. Tente novamente, ou volte para o início se o problema continuar.</p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
      <Button onClick={() => reset()}>TENTAR NOVAMENTE</Button>
      <Button className="outline" onClick={() => router.push("/")}>VOLTAR AO INÍCIO</Button>
    </div>
  </Card></div>;
}
