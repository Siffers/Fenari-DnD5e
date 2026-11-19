/**
 * Extracts Foundry compendium packs (LevelDB) back into JSON source files, so changes made
 * inside Foundry can be committed:
 *
 *   packs/<pack>/  ->  src/packs/<pack>/**.json
 *
 * Existing source files are updated in place (matched by _id); new documents get a new file.
 * Documents deleted in Foundry are removed from the source folder.
 *
 * Usage:  node tools/extract-packs.cjs
 */
const fs = require("fs");
const path = require("path");
const { SRC, OUT, COLLECTIONS, walkJson, loadClassicLevel, assertNotLocked } = require("./level.cjs");

const slug = (name) =>
    String(name ?? "document")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

async function extractPack(ClassicLevel, pack) {
    const dbDir = path.join(OUT, pack);
    const srcDir = path.join(SRC, pack);
    await assertNotLocked(ClassicLevel, dbDir);

    const db = new ClassicLevel(dbDir, { valueEncoding: "json" });
    const entries = new Map();
    for await (const [key, value] of db.iterator()) entries.set(key, value);
    await db.close();

    // where each existing document lives, so edits land in the same file
    const existing = new Map();
    for (const file of walkJson(srcDir)) existing.set(JSON.parse(fs.readFileSync(file, "utf8"))._id, file);

    const written = new Set();
    for (const [type, { key, embedded }] of Object.entries(COLLECTIONS)) {
        for (const [entryKey, doc] of entries) {
            if (!entryKey.startsWith(`!${key}!`)) continue;
            const full = { ...doc };
            for (const [field, collection] of Object.entries(embedded)) {
                full[field] = (doc[field] ?? []).map((id) => entries.get(`!${key}.${collection}!${doc._id}.${id}`)).filter(Boolean);
            }
            const folder = type === "Folder" ? "_folders" : type === "JournalEntry" ? "" : "new";
            const file = existing.get(doc._id) ?? path.join(srcDir, folder, `${slug(doc.name)}.json`);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, JSON.stringify(full, null, 2) + "\n");
            written.add(path.resolve(file));
        }
    }

    for (const file of existing.values()) {
        if (!written.has(path.resolve(file))) {
            fs.rmSync(file);
            console.log(`  removed ${path.relative(srcDir, file)} (deleted in Foundry)`);
        }
    }
    console.log(`  ${pack}: ${written.size} documents -> ${path.relative(process.cwd(), srcDir)}`);
}

(async () => {
    const ClassicLevel = loadClassicLevel();
    const packs = fs.readdirSync(OUT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    console.log(`Extracting ${packs.length} pack(s):`);
    for (const pack of packs) await extractPack(ClassicLevel, pack);
})().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
