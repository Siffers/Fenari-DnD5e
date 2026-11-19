/**
 * Shared helpers for build-packs / extract-packs.
 * Finds a LevelDB library: the `classic-level` npm package (used on GitHub Actions),
 * or the copy that ships inside Foundry VTT (used locally, so nothing needs installing).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src", "packs");
const OUT = path.join(ROOT, "packs");

const FOUNDRY_CANDIDATES = [
    process.env.CLASSIC_LEVEL_PATH,
    "C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/classic-level",
    path.join(process.env.LOCALAPPDATA ?? "", "Programs/Foundry Virtual Tabletop/resources/app/node_modules/classic-level"),
    "/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app/node_modules/classic-level",
].filter(Boolean);

function loadClassicLevel() {
    try {
        return require("classic-level").ClassicLevel;
    } catch {
        for (const candidate of FOUNDRY_CANDIDATES) {
            if (fs.existsSync(candidate)) return require(candidate).ClassicLevel;
        }
    }
    throw new Error(
        "Could not find classic-level. Run `npm install classic-level`, or set CLASSIC_LEVEL_PATH to " +
            "<Foundry install>/resources/app/node_modules/classic-level",
    );
}

/** Document collections, keyed by how a source document is recognised. */
const COLLECTIONS = {
    Item: { key: "items", embedded: { effects: "effects" } },
    JournalEntry: { key: "journal", embedded: { pages: "pages" } },
    Folder: { key: "folders", embedded: {} },
};

function documentType(doc) {
    if ("sorting" in doc && !("system" in doc)) return "Folder";
    if (Array.isArray(doc.pages)) return "JournalEntry";
    return "Item";
}

function walkJson(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walkJson(full);
        return entry.name.endsWith(".json") ? [full] : [];
    });
}

/** Throws a friendly error if Foundry currently has this pack open. */
async function assertNotLocked(ClassicLevel, dir) {
    if (!fs.existsSync(dir)) return;
    const db = new ClassicLevel(dir, { valueEncoding: "json" });
    try {
        await db.open();
    } catch (err) {
        throw new Error(
            `${path.relative(ROOT, dir)} is in use (is Foundry running with a world that uses this module?). ` +
                "Return to Foundry's setup screen and try again.\n" + err.message,
        );
    }
    await db.close();
}

module.exports = { ROOT, SRC, OUT, COLLECTIONS, documentType, walkJson, loadClassicLevel, assertNotLocked };
