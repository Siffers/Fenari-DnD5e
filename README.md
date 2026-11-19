# The Fenari: a D&D 5e species for Foundry VTT

> *"Look, I really don't care about the gold, I just wanna be the first to see what's in the chest!"*
> — A Young Fenari

The Fenari are fluffy little nomads: demi-humans with feline, canine, and other animal features who travel in
caravans, peddling wares and chasing treasure. When a caravan settles down, its families slowly take on the traits
of the people around them. Within a few generations they grow dragon breath, fairy wings, or a Goliath's sturdy
build.

## What's included

- **Seven species** (2024 rules), one for each Fenari culture:
  Nomadic Clan, Dragonborn, Dwarven, Elven, Fairy, Goliath, and Human
- **All their traits as working Foundry items:** Bite (a natural weapon), Enhanced Senses, Dragon's Breath with a
  Scale Color choice, Dwarven Resilience, Stout Warrior / Stone Appreciator, Mask of the Wild, Fairy Flight,
  Compact Power, Versatility, and Nomadic Skill
- **The Fenari lore journal:** history, the Fenari Creed, appearance, names, and every culture

Character creation handles everything through dnd5e's advancement prompts: drag a Fenari species onto a character
and pick its options.

## Requirements

- Foundry VTT v13–v14
- dnd5e 6.0 or later

## Install

In Foundry's setup screen open **Add-on Modules → Install Module**, paste this into **Manifest URL**, and click
**Install**:

```
https://github.com/Siffers/Fenari-DnD5e/releases/latest/download/module.json
```

Then enable **Sif's Fenari 5e Race** in your world.

## Editing the content

The compendiums are built from the JSON files in `src/packs/`. You can edit those files directly, or edit inside
Foundry and save your changes back:

1. Edit the items or journal in Foundry's compendium (unlock it first).
2. Return to Foundry's **setup screen**, since the packs can't be read while a world is using them.
3. Run `tools/extract-packs.cjs` to write the changes into `src/packs/`, then commit.

### Building the compendiums

`tools/build-packs.cjs` turns `src/packs/` into `packs/`. With Node.js installed:

```
node tools/build-packs.cjs
```

Without Node.js on Windows, the script can borrow VS Code's runtime and Foundry's own database library:

```powershell
$env:ELECTRON_RUN_AS_NODE = 1
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tools\build-packs.cjs
```

(Use `tools\extract-packs.cjs` the same way.) Both scripts stop with a message if Foundry has the packs open.

## Releasing

Publish a GitHub release with a version tag (e.g. `2.0.1`). A GitHub Action builds the compendiums, stamps the
version, and attaches `module.json` and `module.zip` to the release. Foundry picks up the update automatically.

## Credits

Created by Siffers. See [LICENSE-NOTICES.md](LICENSE-NOTICES.md) for SRD 5.2 attribution.
