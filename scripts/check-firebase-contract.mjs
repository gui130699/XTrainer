import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = basename(root);
const peerName = project === "XTrainer" ? "XTrainer-Admin" : "XTrainer";
const peer = resolve(process.env.FIREBASE_CONTRACT_PEER || resolve(root, "..", peerName));
const files = [
  "firestore.rules",
  "firestore.indexes.json",
  "src/types/index.ts",
  "src/data/default-exercises.ts",
  "src/data/default-training-methods.ts",
];

if (!existsSync(peer)) {
  throw new Error(`Repositório parceiro não encontrado em ${peer}. Defina FIREBASE_CONTRACT_PEER.`);
}

const normalize = (value) => value.replace(/\r\n/g, "\n").trim();
const divergent = files.filter((file) => {
  const localPath = resolve(root, file);
  const peerPath = resolve(peer, file);
  return !existsSync(localPath)
    || !existsSync(peerPath)
    || normalize(readFileSync(localPath, "utf8")) !== normalize(readFileSync(peerPath, "utf8"));
});

if (divergent.length) {
  throw new Error(`Contrato Firebase divergente entre ${project} e ${peerName}: ${divergent.join(", ")}`);
}

console.log(`Contrato Firebase sincronizado com ${peerName}: ${files.length} arquivos verificados.`);
