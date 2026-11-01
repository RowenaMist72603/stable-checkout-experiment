import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_checkout_client.js";
import { assignCheckout } from "./checkout_split_service.js";

async function bodyOf(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/checkout-orders") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }
  try {
    const result = await assignCheckout(await bodyOf(request));
    response.writeHead(201).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid checkout body" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.message }));
      return;
    }
    response.writeHead(400).end(JSON.stringify({ error: error instanceof Error ? error.message : "Request rejected" }));
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log("Checkout service listening on http://localhost:3000"));
