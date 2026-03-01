#!/usr/bin/env node
import os from "os";
const nets = os.networkInterfaces();
for (const name of Object.keys(nets)) {
  for (const n of nets[name]) {
    if (n.family === "IPv4" && !n.internal) {
      console.log("\n  On this network open: http://" + n.address + ":3000\n");
      process.exit(0);
    }
  }
}
console.log("\n  Dev server will listen on 0.0.0.0:3000. Use your machine's IP in the browser.\n");
