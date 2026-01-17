import { treaty } from "@elysiajs/eden";
import  { type App } from "@repo/api";


export const api = treaty<App>("localhost:3000");