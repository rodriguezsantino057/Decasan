import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const groqKey = process.env.GROQ_API_KEY;

async function getModels() {
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { "Authorization": `Bearer ${groqKey}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.data.map(m => m.id), null, 2));
}

getModels();
