// src/server.ts — entry point del servidor para TanStack Start
// Para Vercel (Node.js), Nitro genera el handler automáticamente a partir de este archivo.
// El error handling está en src/start.ts como middleware global.
import "./lib/error-capture";

export { startInstance } from "./start";
