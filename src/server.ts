import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`API running at http://localhost:${env.port}`);
});
