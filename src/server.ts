import { config } from "./config";
import { createApp } from "./app";

const app = createApp();

app.listen(config.port, () => {
  console.log(`current-quest-backend listening on port ${config.port} (${config.nodeEnv})`);
});
