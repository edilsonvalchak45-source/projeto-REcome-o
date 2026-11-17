import { writeFile } from "node:fs/promises";

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  RECOMMENDER_API_URL: process.env.RECOMMENDER_API_URL || ""
};

const output = `window.RECOMECO_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
await writeFile(new URL("../js/runtime-config.js", import.meta.url), output, "utf8");
console.log("Configuração pública do frontend gerada. Nenhuma chave privada foi incluída.");
