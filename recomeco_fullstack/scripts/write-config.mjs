import { readFile, writeFile } from "node:fs/promises";

const localEnv = new Map();
try {
  const contents = await readFile(new URL("../../.env", import.meta.url), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(SUPABASE_URL|SUPABASE_ANON_KEY|RECOMMENDER_API_URL)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    localEnv.set(match[1], value);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const getEnv = name => process.env[name] || localEnv.get(name) || "";
const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
const supabaseKeyPayload = supabaseAnonKey.split(".")[1];
let usesServiceRoleKey = supabaseAnonKey.startsWith("sb_secret_");
if (supabaseKeyPayload) {
  try {
    usesServiceRoleKey ||= JSON.parse(Buffer.from(supabaseKeyPayload, "base64url").toString("utf8")).role === "service_role";
  } catch {
    // Non-JWT public keys do not have a decodable role claim.
  }
}
if (usesServiceRoleKey) {
  throw new Error("SUPABASE_ANON_KEY não pode ser uma chave service_role ou secret.");
}

const config = {
  SUPABASE_URL: getEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: supabaseAnonKey,
  RECOMMENDER_API_URL: getEnv("RECOMMENDER_API_URL")
};

const output = `window.RECOMECO_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
await writeFile(new URL("../js/runtime-config.js", import.meta.url), output, "utf8");
console.log("Configuração pública do frontend gerada. Nenhuma chave privada foi incluída.");
