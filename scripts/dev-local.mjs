import { spawn } from "node:child_process";
import net from "node:net";

const apiCommand = "vercel";
const apiArgs = ["dev", "--listen", "3001", "--yes"];

const webCommand = "npm";
const webArgs = ["run", "dev:web"];

const waitForPort = (port, host, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      const socket = net.createConnection({ port, host });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timeout waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 300);
      });
    };

    attempt();
  });

const run = () => {
  const api = spawn(apiCommand, apiArgs, {
    stdio: "inherit",
    shell: true,
  });

  const stopAll = () => {
    api.kill("SIGINT");
    process.exit(0);
  };

  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);

  waitForPort(3001, "127.0.0.1")
    .then(() => {
      const web = spawn(webCommand, webArgs, {
        stdio: "inherit",
        shell: true,
      });

      web.on("exit", () => {
        api.kill("SIGINT");
        process.exit(0);
      });
    })
    .catch((error) => {
      console.error(`[dev] ${error.message}`);
      api.kill("SIGINT");
      process.exit(1);
    });
};

run();
