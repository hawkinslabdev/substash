import { generate } from "@graphql-codegen/cli";
import * as dotenv from "node:process";

const STASH_URL = process.env.STASH_URL ?? "http://localhost:9999";
const STASH_API_KEY = process.env.STASH_API_KEY ?? "";

await generate({
  schema: {
    [`${STASH_URL}/graphql`]: {
      headers: STASH_API_KEY ? { ApiKey: STASH_API_KEY } : {},
    },
  },
  documents: ["src/lib/stash/queries.ts"],
  generates: {
    "src/lib/stash/types.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        scalars: {
          Time: "string",
          Int64: "number",
          Upload: "File",
        },
        enumsAsTypes: true,
        avoidOptionals: false,
        maybeValue: "T | null | undefined",
      },
    },
  },
});

console.log("Types generated → src/lib/stash/types.ts");
