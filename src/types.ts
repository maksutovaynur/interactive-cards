import type { ComponentType } from 'preact';

export type LevelStatus = 'untouched' | 'viewed' | 'completed';

export type RuntimeCard = {
  id: string;
  order: number;
  imageUrl: string;
};

export type DiscoveredLevel = {
  id: string;
  title: string;
  previewUrl: string;
  cards: RuntimeCard[];
};

export type GameProgressMode = {
  persistPartialState: boolean;
};

export type GamePlugin = {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: GameProgressMode;
  discoverLevels: () => Promise<DiscoveredLevel[]>;
  Play: ComponentType<{
    game: GamePlugin;
    levelId: string;
    onBack: () => void;
    onOpenLevel: (levelId: string) => void;
  }>;
};

export type RouteState = {
  gameId?: string;
  levelId?: string;
};
