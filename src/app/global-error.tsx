"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <html lang="pt-BR">
    <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#07111f", color: "#f4f8fb", fontFamily: "Arial, Helvetica, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 420, textAlign: "center", display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>O XTrainer não conseguiu carregar</h1>
        <p style={{ color: "#8fa3b8", margin: 0 }}>Ocorreu um erro inesperado. Tente recarregar a página.</p>
        <button onClick={() => reset()} style={{ border: 0, borderRadius: 12, background: "#0ea5e9", color: "white", minHeight: 44, padding: "0 20px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>TENTAR NOVAMENTE</button>
      </div>
    </body>
  </html>;
}
