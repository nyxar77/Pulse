import adapter from "@sveltejs/adapter-static";
import { readFileSync } from "node:fs";

const packageVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    version: {
      name: packageVersion,
    },
  },
};

export default config;
