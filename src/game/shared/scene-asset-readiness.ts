import type { RuntimeImageLoadResult } from '../runtime-images';

type AssetReadinessGroupState = {
  settled: boolean;
  timedOut: boolean;
  failedKeys: string[];
};


export type SceneAssetReadinessState = {
  phase: 'loading' | 'transition' | 'interactive' | 'full-art';
  interactive: boolean;
  fullArt: boolean;
  timeToFirstInteractionMs: number | null;
  timeToFullArtMs: number | null;
  pendingGroups: string[];
  failedGroups: string[];
  timedOutGroups: string[];
  failures: Array<{ group: string; keys: string[] }>;
};


export class SceneAssetReadinessTracker {
  private startedAtMs = performance.now();
  private firstInteractionAtMs?: number;
  private fullArtAtMs?: number;
  private groups = new Map<string, AssetReadinessGroupState>();

  reset(groups: readonly string[]) {
    this.startedAtMs = performance.now();
    this.firstInteractionAtMs = undefined;
    this.fullArtAtMs = undefined;
    this.groups = new Map(groups.map((group) => [group, {
      settled: false,
      timedOut: false,
      failedKeys: [],
    }]));
  }

  settle(group: string, result?: RuntimeImageLoadResult) {
    this.groups.set(group, {
      settled: true,
      timedOut: result?.timedOut ?? false,
      failedKeys: [...(result?.failedKeys ?? [])],
    });
  }

  markInteractive() {
    this.firstInteractionAtMs ??= performance.now();
  }

  markFullArt() {
    if ([...this.groups.values()].some((group) => !group.settled || group.failedKeys.length)) return;
    this.fullArtAtMs ??= performance.now();
  }

  groupSettled(group: string) {
    return this.groups.get(group)?.settled ?? false;
  }

  snapshot(): SceneAssetReadinessState {
    const entries = [...this.groups.entries()];
    const elapsed = (at?: number) => at === undefined
      ? null
      : Math.max(0, Math.round(at - this.startedAtMs));
    return {
      phase: this.firstInteractionAtMs === undefined
        ? this.fullArtAtMs !== undefined ? 'transition' : 'loading'
        : this.fullArtAtMs !== undefined
          ? 'full-art'
          : 'interactive',
      interactive: this.firstInteractionAtMs !== undefined,
      fullArt: this.fullArtAtMs !== undefined,
      timeToFirstInteractionMs: elapsed(this.firstInteractionAtMs),
      timeToFullArtMs: elapsed(this.fullArtAtMs),
      pendingGroups: entries.filter(([, state]) => !state.settled).map(([group]) => group),
      failedGroups: entries.filter(([, state]) => state.failedKeys.length).map(([group]) => group),
      timedOutGroups: entries.filter(([, state]) => state.timedOut).map(([group]) => group),
      failures: entries
        .filter(([, state]) => state.failedKeys.length)
        .map(([group, state]) => ({ group, keys: [...state.failedKeys] })),
    };
  }
}
