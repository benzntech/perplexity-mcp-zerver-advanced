#!/usr/bin/env node

import { PerplexityServer } from "./server/PerplexityServer.js";

async function run() {
  const server = await PerplexityServer.create();
  await server.run();
}

run().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
