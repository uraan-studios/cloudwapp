import { Elysia, t } from "elysia";

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .ws("/chat", {
    body: t.String(),
    response: t.String(),
    message(ws, message) {
      if (message === "ping") {
        ws.send("ding");
      } else {
        ws.send(message);
      }
    },
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;