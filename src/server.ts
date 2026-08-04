// src/server.ts — entry point del servidor para TanStack Start
import "./lib/error-capture";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

export { startInstance } from "./start";

export default createStartHandler(defaultStreamHandler);

