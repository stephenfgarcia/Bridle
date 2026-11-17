// `pnpm i18n:pseudo` (card P0-02.6): writes messages/en-XA.json from messages/en.json. The output is
// committed; src/index.test.ts fails when the two disagree. Node strips the types of ../src/pseudo.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { pseudoCatalog } from "../src/pseudo.ts";

const source = new URL("../messages/en.json", import.meta.url);
const target = new URL("../messages/en-XA.json", import.meta.url);
const catalog = pseudoCatalog(JSON.parse(readFileSync(source, "utf8")));
writeFileSync(target, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`i18n:pseudo: wrote messages/en-XA.json (${Object.keys(catalog).length} messages)`);
