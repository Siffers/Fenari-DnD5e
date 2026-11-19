/**
 * Exports the lore journals as Markdown text files (for the design doc).
 * Culture pages are expanded with the full rules text of their traits.
 *
 * Usage:  node tools/export-lore.cjs <output folder>
 */
const fs = require("fs");
const path = require("path");
const { SRC, walkJson } = require("./level.cjs");

const outDir = path.resolve(process.argv[2] ?? "lore-export");
const items = new Map(walkJson(path.join(SRC, "the-fenari")).map((f) => {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    return [doc._id, doc];
}));
const SPELLS = {
    phbsplDruidcraft: "Druidcraft", phbsplSpeakwithA: "Speak with Animals", phbsplMinorIllus: "Minor Illusion",
    phbsplFaerieFire: "Faerie Fire", phbsplInvisibili: "Invisibility", phbsplIdentify00: "Identify",
    phbsplMending000: "Mending", phbsplPrestidigi: "Prestidigitation",
};
const ORDINAL = { 1: "1st", 3: "3rd", 5: "5th" };

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Small HTML -> Markdown converter for the tags this module's text uses. */
function toMarkdown(html) {
    let s = html
        .replace(/<p><em>Foundry note:[\s\S]*?<\/em><\/p>/g, "")              // implementation notes
        .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")                             // links -> their label
        .replace(/<table>([\s\S]*?)<\/table>/g, (_, t) => {
            const rows = [...t.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
                [...r[1].matchAll(/<t[hd]>([\s\S]*?)<\/t[hd]>/g)].map((c) => inline(c[1]).replace(/\|/g, "\\|")));
            if (!rows.length) return "";
            const widths = rows[0].length;
            const line = (cells) => `| ${cells.join(" | ")} |`;
            return "\n" + [line(rows[0]), line(Array(widths).fill("---")), ...rows.slice(1).map(line)].join("\n") + "\n\n";
        })
        .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_, b) =>
            [...b.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => `> ${inline(p[1])}`).join("\n>\n") + "\n\n")
        .replace(/<ol>([\s\S]*?)<\/ol>/g, (_, l) =>
            [...l.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li, i) => `${i + 1}. ${inline(li[1])}`).join("\n") + "\n\n")
        .replace(/<ul>([\s\S]*?)<\/ul>/g, (_, l) =>
            [...l.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => `- ${inline(li[1])}`).join("\n") + "\n\n")
        .replace(/<h2>([\s\S]*?)<\/h2>/g, (_, h) => `## ${inline(h)}\n\n`)
        .replace(/<h3>([\s\S]*?)<\/h3>/g, (_, h) => `### ${inline(h)}\n\n`)
        .replace(/<p>([\s\S]*?)<\/p>/g, (_, p) => `${inline(p)}\n\n`);
    return decode(s.replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function inline(html) {
    return decode(html
        .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, "**$2**")
        .replace(/<(em|i)>([\s\S]*?)<\/\1>/g, "*$2*")
        .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
        .replace(/<[^>]+>/g, "")).trim();
}

/** The full rules text for a Culture: each trait by level, plus spells. */
function cultureTraits(culture) {
    const byLevel = {};
    for (const adv of Object.values(culture.system.advancement)) {
        const list = (byLevel[adv.level] ??= []);
        for (const { uuid } of adv.configuration.items ?? []) {
            const id = uuid.split(".").pop();
            if (adv.configuration.spell) list.push({ spell: SPELLS[id] ?? id });
            else if (items.has(id)) list.push({ item: items.get(id) });
        }
    }
    let md = `## ${culture.name} Traits\n\n`;
    for (const level of Object.keys(byLevel).sort()) {
        md += `### ${ORDINAL[level] ?? level} Level\n\n`;
        for (const entry of byLevel[level]) {
            if (entry.spell) {
                md += `**Spell: *${entry.spell}*.** You learn this spell${level === "1" ? " (a cantrip)" : ", and can cast it once per Long Rest without a spell slot"}.\n\n`;
                continue;
            }
            const text = toMarkdown(entry.item.system.description.value).trim();
            md += `**${entry.item.name}.** ${text}\n\n`;
            // choice traits (e.g. Dwarven Upbringing): include each option's rules; lineage pools (scale
            // colors) are already summarized by the trait's own table
            for (const adv of Object.values(entry.item.system.advancement ?? {})) {
                if (adv.type !== "ItemChoice" || adv.configuration.restriction?.subtype === "lineage") continue;
                for (const { uuid } of adv.configuration.pool ?? []) {
                    const option = items.get(uuid.split(".").pop());
                    if (option) md += `- **${option.name}.** ${toMarkdown(option.system.description.value).trim().replace(/\n\n/g, " ")}\n`;
                }
                md += "\n";
            }
        }
    }
    if (Object.values(culture.system.advancement).some((a) => a.configuration.spell)) {
        md += "*Spellcasting ability: Intelligence, Wisdom, or Charisma (chosen when you select this Culture).*\n\n";
    }
    return md;
}

function exportJournal(pack, subdir = "") {
    const dir = path.join(outDir, subdir);
    fs.mkdirSync(dir, { recursive: true });
    for (const file of walkJson(path.join(SRC, pack))) {
        const journal = JSON.parse(fs.readFileSync(file, "utf8"));
        journal.pages.sort((a, b) => a.sort - b.sort).forEach((page, i) => {
            let content = page.text.content;
            let extra = "";
            const embed = content.match(/@Embed\[Compendium\.[^\]]*?Item\.([A-Za-z0-9]{16})[^\]]*\]/);
            if (embed && items.has(embed[1])) {
                extra = cultureTraits(items.get(embed[1]));
                content = content.replace(/<p>@Embed\[[^\]]*\]<\/p>/, "");
            }
            const md = `# ${page.name}\n\n${toMarkdown(content)}\n${extra}`.replace(/\n{3,}/g, "\n\n");
            const name = `${String(i + 1).padStart(2, "0")} - ${page.name.replace(/[\\/:*?"<>|]/g, "")}.md`;
            fs.writeFileSync(path.join(dir, name), md.trimEnd() + "\n");
            console.log(`  ${path.join(subdir, name)}`);
        });
    }
}

console.log(`Exporting lore to ${outDir}`);
exportJournal("fenari-lore");
exportJournal("fenari-secrets", "GM Secrets");
