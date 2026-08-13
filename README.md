# XTrainer

PWA pessoal, mobile-first, para registrar musculação, evolução corporal e histórico de treinos. Não é um sistema de academia: a administração serve apenas para configurar o próprio perfil e a própria rotina.

## Stack

Next.js (App Router), React, TypeScript, Firebase Authentication, Cloud Firestore, Firebase Storage, Recharts, React Hook Form/Zod e Lucide.

## Executar

1. Copie `.env.example` para `.env.local` e confirme as credenciais Firebase.
2. `npm install`
3. `npm run dev`
4. Acesse `http://localhost:3000` e crie o primeiro administrador.

O primeiro cadastro grava `system/config` e o UID administrador. As regras Firebase devem ser publicadas antes do uso público: `firebase deploy --only firestore:rules,firestore:indexes,storage`.

## Dados e segurança

As coleções principais são `users`, `exercises`, `workouts`, `workoutSessions`, `bodyWeights`, `physicalAssessments`, `personalRecords` e `system/config`. Cada sessão guarda um snapshot dos exercícios e séries, preservando o histórico mesmo após editar um treino. As regras estão em `firestore.rules` e `storage.rules`.

## PWA e publicação

O manifesto está em `public/manifest.webmanifest`; navegadores compatíveis oferecem instalação pelo menu. Execute `npm run build` antes de publicar em Vercel, Firebase Hosting ou outro host de Next.js.
