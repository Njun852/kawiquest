/**
 * Write recognition/model/labels.json: the CNN's class order. Output index i is character_id i + 1 (the 87
 * characters in inventory order), and the last index is the reject class. Training and the recognition service
 * must both use this file, so a class index always means the same character.
 *
 *   npm run export-labels
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { INVENTORY_SIZE } from "../src/lib/constants";
import { kawiCharacters } from "../src/lib/curriculum/seed-data";

const classes = [
  ...kawiCharacters.map((c, i) => ({
    index: i,
    character_id: c.character_id,
    name: c.name,
    transliteration: c.transliteration,
    unicode_codepoint: c.unicode_codepoint,
  })),
  { index: kawiCharacters.length, character_id: null, name: "REJECT", transliteration: "(not a character)", unicode_codepoint: null },
];
if (kawiCharacters.length !== INVENTORY_SIZE) throw new Error(`Expected ${INVENTORY_SIZE} characters, got ${kawiCharacters.length}`);
const out = join(__dirname, "..", "recognition", "model", "labels.json");
writeFileSync(out, JSON.stringify({ format: "kawiquest-labels/1", classes }, null, 2) + "\n");
console.log(`Wrote ${classes.length} classes to ${out}`);
