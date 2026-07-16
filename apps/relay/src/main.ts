import { createRelay } from "./relay";

const coreUrl = process.env.CLASP_CORE_URL ?? "http://127.0.0.1:8787";
const port = Number(process.env.PORT ?? 8790);

createRelay({ coreUrl }).listen(port, () => {
  console.log(`clasp relay listening on http://127.0.0.1:${port} -> core ${coreUrl}`);
  console.log("relay is transport-only: it holds no wallet key and no FNN RPC URL");
});
