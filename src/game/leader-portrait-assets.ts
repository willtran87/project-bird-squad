import type { RuntimeImageAsset } from './runtime-images';
const codexLeaderRuntimeArtUrls = import.meta.glob('../../assets/runtime/flock/leaders/*-front-3q.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const codexLeaderArtAssets: Record<string, RuntimeImageAsset> = {
  fledgling: {
    key: 'codex-flock-leader-fledgling-front-3q',
    url: codexLeaderRuntimeArtUrls['../../assets/runtime/flock/leaders/fledgling-flock-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/fledgling-flock-combat-front-3q.webp',
  },
  roostkeeper: {
    key: 'codex-flock-leader-roostkeeper-front-3q',
    url: codexLeaderRuntimeArtUrls['../../assets/runtime/flock/leaders/roostkeeper-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/roostkeeper-combat-front-3q.webp',
  },
  spark_caller: {
    key: 'codex-flock-leader-spark-caller-front-3q',
    url: codexLeaderRuntimeArtUrls['../../assets/runtime/flock/leaders/spark-caller-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/spark-caller-combat-front-3q.webp',
  },
  talon: {
    key: 'codex-flock-leader-talon-front-3q',
    url: codexLeaderRuntimeArtUrls['../../assets/runtime/flock/leaders/talon-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/talon-combat-front-3q.webp',
  },
  tidewarden: {
    key: 'codex-flock-leader-tidewarden-front-3q',
    url: codexLeaderRuntimeArtUrls['../../assets/runtime/flock/leaders/tidewarden-combat-front-3q.webp']
      ?? '/assets/runtime/flock/leaders/tidewarden-combat-front-3q.webp',
  },
};
