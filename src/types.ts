import type { ComponentType } from 'preact';

export type LevelStatus = 'untouched' | 'viewed' | 'completed';

export type RuntimeCard = {
  id: string;
  order: number;
  imageUrl: string;
  width: number;
  height: number;
};

export type DiscoveredLevel = {
  id: string;
  title: string;
  previewUrl: string;
  aspectRatio: number;
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
  discoverLevels: (options?: DiscoverLevelsOptions) => Promise<DiscoveredLevel[]>;
  Play: ComponentType<{
    game: GamePlugin;
    levelId: string;
    onBack: () => void;
    onOpenLevel: (levelId: string) => void;
  }>;
};

export type DiscoverLevelsOptions = {
  onLevel?: (level: DiscoveredLevel) => void;
};

export type RouteState = {
  gameId?: string;
  levelId?: string;
};
