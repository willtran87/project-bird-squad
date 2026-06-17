#!/usr/bin/env python
"""Build runtime enemy art from generated transparent masters.

Source/master images live under `.generated`; optimized game assets live under
`assets/runtime`. The game loads only the runtime assets.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GENERATED_ROOT = ROOT / ".generated" / "imagegen" / "enemies"
SELECTED_ROOT = GENERATED_ROOT / "selected"
CONTACT_ROOT = GENERATED_ROOT / "contact-sheets"
RUNTIME_ROOT = ROOT / "assets" / "runtime" / "enemies"
FULL_ROOT = RUNTIME_ROOT / "full"
RESERVE_SELECTED_ROOT = GENERATED_ROOT / "reserve-selected"
RESERVE_RUNTIME_ROOT = RUNTIME_ROOT / "reserve"
MANIFEST_PATH = RUNTIME_ROOT / "enemy-art-manifest.json"
RESERVE_CONTRACTS_PATH = ROOT / "data" / "game" / "enemy-variety-contracts.json"


ENEMY_SOURCES = {
    "roof_rat": "roof-rat-3q-transparent.png",
    "signal_gull": "signal-gull-3q-v6-transparent.png",
    "wire_hawk": "wire-hawk-3q-grounded-transparent.png",
    "tarline_jackdaw": "tarline-jackdaw-3q-grounded-transparent.png",
    "gutter_baron": "gutter-baron-3q-dramatic-idle-transparent.png",
    "tar_crowned_crow": "tar-crowned-crow-front-transparent.png",
    "canal_dock_warden": "dock-warden-3q-dramatic-idle-transparent.png",
    "canal_dock_rat": "dock-rat-3q-dramatic-idle-transparent.png",
    "canal_market_crow": "market-crow-3q-dramatic-idle-transparent.png",
    "canal_dredge_eel": "dredge-eel-3q-dramatic-idle-transparent.png",
    "canal_barge_gull": "barge-gull-3q-dramatic-idle-transparent.png",
    "canal_lock_keeper": "lock-keeper-3q-dramatic-idle-transparent.png",
    "canal_ferry_cormorant": "ferry-cormorant-3q-dramatic-idle-transparent.png",
    "canal_toll_magpie": "toll-magpie-3q-dramatic-idle-transparent.png",
    "canal_heron_boss": "canal-gatekeeper-3q-dramatic-idle-transparent.png",
    "spire_signal_marshal": "signal-marshal-3q-dramatic-idle-transparent.png",
    "spire_relay_starling": "relay-starling-3q-dramatic-idle-transparent.png",
    "spire_aerial_kite": "aerial-kite-3q-dramatic-idle-transparent.png",
    "spire_tower_pigeon": "tower-pigeon-3q-dramatic-idle-transparent.png",
    "spire_static_swift": "static-swift-3q-dramatic-idle-transparent.png",
    "spire_beacon_grackle": "beacon-grackle-3q-dramatic-idle-transparent.png",
    "spire_signal_kite": "aerial-signal-kite-3q-dramatic-idle-transparent.png",
    "spire_tollkeeper_kestrel": "tollkeeper-kestrel-3q-dramatic-idle-transparent.png",
    "spire_beacon_breaker": "beacon-breaker-3q-dramatic-idle-transparent.png",
    "roost_iron_talon": "iron-talon-3q-dramatic-idle-transparent.png",
    "roost_perch_thug": "perch-thug-3q-dramatic-idle-transparent.png",
    "roost_wind_shrike": "wind-shrike-3q-dramatic-idle-transparent.png",
    "roost_tar_drifter": "tar-drifter-3q-dramatic-idle-transparent.png",
    "roost_relay_falcon": "relay-falcon-3q-dramatic-idle-transparent.png",
    "roost_spire_sentinel": "spire-sentinel-3q-dramatic-idle-transparent.png",
    "roost_kettle_harrier": "kettle-harrier-3q-dramatic-idle-transparent.png",
    "roost_skyline_baron": "skyline-baron-3q-dramatic-idle-transparent.png",
    "roost_warden": "roost-warden-3q-dramatic-idle-transparent.png",
}

LOSSY_FULL_ENEMIES = {
    "canal_barge_gull",
    "canal_dredge_eel",
    "gutter_baron",
    "roost_iron_talon",
    "roost_kettle_harrier",
    "roost_relay_falcon",
    "roost_skyline_baron",
    "roost_spire_sentinel",
    "roost_tar_drifter",
    "roost_warden",
    "roost_wind_shrike",
    "signal_gull",
    "spire_signal_marshal",
    "tar_crowned_crow",
    "wire_hawk",
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def source_candidates(filename: str) -> list[Path]:
    return [
        SELECTED_ROOT / filename,
        ROOT / "output" / "imagegen" / "enemies" / filename,
    ]


def copy_master(enemy_id: str, filename: str) -> Path:
    selected = SELECTED_ROOT / f"{enemy_id}.png"
    if selected.exists():
        return selected
    for candidate in source_candidates(filename):
        if candidate.exists():
            SELECTED_ROOT.mkdir(parents=True, exist_ok=True)
            shutil.copy2(candidate, selected)
            return selected
    raise FileNotFoundError(f"Missing generated source for {enemy_id}: {filename}")


def optimize(master: Path, target: Path, max_edge: int = 768, lossy: bool = False, quality: int = 82) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(master).convert("RGBA") as image:
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        if lossy:
            image.save(target, "WEBP", quality=quality, method=4, exact=False)
        else:
            image.save(target, "WEBP", lossless=True, method=6)


def reserve_source(enemy_id: str) -> Path:
    source = RESERVE_SELECTED_ROOT / f"{enemy_id}-transparent.png"
    if not source.exists():
        raise FileNotFoundError(f"Missing reserve enemy source for {enemy_id}: {rel(source)}")
    return source


def build_reserve_enemies() -> int:
    contract = json.loads(RESERVE_CONTRACTS_PATH.read_text(encoding="utf-8"))
    enemies = contract.get("reserveEnemies", [])
    if not isinstance(enemies, list):
        raise ValueError(f"{rel(RESERVE_CONTRACTS_PATH)}: reserveEnemies must be a list")

    built = 0
    for enemy in enemies:
        enemy_id = enemy.get("id")
        if not isinstance(enemy_id, str):
            raise ValueError(f"{rel(RESERVE_CONTRACTS_PATH)}: reserve enemy missing string id")
        optimize(reserve_source(enemy_id), RESERVE_RUNTIME_ROOT / f"{enemy_id}.webp", max_edge=704, lossy=True, quality=82)
        built += 1
    return built


def copy_contact_sheets() -> None:
    source = ROOT / "output" / "imagegen" / "enemies" / "enemy-cast-remaining-contact-sheet.png"
    if source.exists():
        CONTACT_ROOT.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, CONTACT_ROOT / source.name)


def main() -> None:
    entries = []
    for enemy_id, filename in ENEMY_SOURCES.items():
        master = copy_master(enemy_id, filename)
        full = FULL_ROOT / f"{enemy_id}.webp"
        lossy = enemy_id in LOSSY_FULL_ENEMIES
        optimize(master, full, max_edge=704 if lossy else 768, lossy=lossy, quality=82)
        entries.append(
            {
                "enemyId": enemy_id,
                "source": rel(master),
                "full": rel(full),
                "version": "0.1",
                "status": "approved",
            }
        )

    copy_contact_sheets()
    reserve_count = build_reserve_enemies()
    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "version": "0.1",
                "project": "Bird Squad",
                "basedOn": [
                    "docs/art/enemy-art-bible.md",
                    "data/game/alpha-enemies.json",
                    "data/game/map02-content.json",
                    "data/game/map03-content.json",
                    "data/game/map04-content.json",
                ],
                "enemies": entries,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(entries)} enemy runtime assets.")
    print(f"Built {reserve_count} reserve enemy runtime assets.")
    print(rel(MANIFEST_PATH))


if __name__ == "__main__":
    main()
