/**
 * Builds Foundry compendium packs (LevelDB) from the JSON source files.
 *
 *   src/packs/<pack>/**.json  ->  packs/<pack>/
 *
 * Embedded documents (item effects, journal pages) are stored inline in the source files
 * and split into their own LevelDB entries here, the way Foundry stores them.
 *
 * Usage:  node tools/build-packs.cjs [outDir]
 *         (locally without Node: see README, "Building the compendiums")
 */
const fs = require("fs");
const path = require("path");
const { SRC, OUT, COLLECTIONS, documentType, walkJson, loadClassicLevel, assertNotLocked } = require("./level.cjs");

async function buildPack(ClassicLevel, pack, outRoot) {
    const srcDir = path.join(SRC, pack);
    const outDir = path.join(outRoot, pack);

    await assertNotLocked(ClassicLevel, outDir);
    fs.rmSync(outDir, { recursive: true, force: true });

    const db = new ClassicLevel(outDir, { valueEncoding: "json" });
    await db.open();
    const batch = db.batch();
    const ids = new Set();
    let count = 0;

    for (const file of walkJson(srcDir).sort()) {
        const doc = JSON.parse(fs.readFileSync(file, "utf8"));
        const type = documentType(doc);
        const { key, embedded } = COLLECTIONS[type];

        if (!doc._id || ids.has(doc._id)) throw new Error(`${file}: missing or duplicate _id ${doc._id}`);
        ids.add(doc._id);

        const stored = { ...doc };
        delete stored._key;
        for (const [field, collection] of Object.entries(embedded)) {
            const children = doc[field] ?? [];
            stored[field] = children.map((child) => child._id);
            for (const child of children) {
                const { _key, ...childData } = child;
                batch.put(`!${key}.${collection}!${doc._id}.${child._id}`, childData);
            }
        }

        batch.put(`!${key}!${doc._id}`, stored);
        count++;
    }

    await batch.write();
    await db.compactRange("\x00", "\xff");
    await db.close();
    console.log(`  ${pack}: ${count} documents -> ${path.relative(process.cwd(), outDir)}`);
}

(async () => {
    const outRoot = path.resolve(process.argv[2] ?? OUT);
    const ClassicLevel = loadClassicLevel();
    const packs = fs.readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    console.log(`Building ${packs.length} pack(s):`);
    for (const pack of packs) await buildPack(ClassicLevel, pack, outRoot);
})().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
