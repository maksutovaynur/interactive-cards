import type { LevelStatus } from './types';

type StoredProgress = Record<string, Record<string, LevelStatus>>;

const progressKey = 'interactive-cards.progress.v1';
const zoomKeyPrefix = 'interactive-cards.zoom.v1.';

export function getLevelStatus(gameId: string, levelId: string): LevelStatus {
  return readProgress()[gameId]?.[levelId] ?? 'untouched';
}

export function markLevelViewed(gameId: string, levelId: string) {
  const current = getLevelStatus(gameId, levelId);

  if (current === 'completed') {
    return;
  }

  setLevelStatus(gameId, levelId, 'viewed');
}

export function markLevelCompleted(gameId: string, levelId: string) {
  setLevelStatus(gameId, levelId, 'completed');
}

export function getGameProgressSummary(gameId: string) {
  const levels = Object.values(readProgress()[gameId] ?? {});

  return {
    viewed: levels.filter((status) => status === 'viewed').length,
    completed: levels.filter((status) => status === 'completed').length,
  };
}

export function getGameZoom(gameId: string) {
  try {
    const raw = window.localStorage.getItem(`${zoomKeyPrefix}${gameId}`);
    const value = raw ? Number(raw) : 1.15;

    return Number.isFinite(value) ? clampZoom(value) : 1.15;
  } catch {
    return 1.15;
  }
}

export function setGameZoom(gameId: string, zoom: number) {
  try {
    window.localStorage.setItem(`${zoomKeyPrefix}${gameId}`, String(clampZoom(zoom)));
  } catch {
    // Zoom is a convenience preference; the game remains usable without storage.
  }
}

export function clampZoom(zoom: number) {
  return Math.min(1.6, Math.max(0.9, Math.round(zoom * 100) / 100));
}

function setLevelStatus(gameId: string, levelId: string, status: LevelStatus) {
  const progress = readProgress();
  progress[gameId] = {
    ...(progress[gameId] ?? {}),
    [levelId]: status,
  };
  writeProgress(progress);
}

function readProgress(): StoredProgress {
  try {
    const raw = window.localStorage.getItem(progressKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeProgress(progress: StoredProgress) {
  try {
    window.localStorage.setItem(progressKey, JSON.stringify(progress));
  } catch {
    // Progress is helpful but the game remains playable without storage.
  }
}
