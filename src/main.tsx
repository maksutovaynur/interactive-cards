import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import './styles.css';
import { games } from './registry';
import { getGameProgressSummary, getLevelStatus, markLevelViewed } from './storage';
import type { DiscoveredLevel, GamePlugin, RouteState } from './types';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

render(<App />, root);

function App() {
  const [route, setRoute] = useHashRoute();
  const game = route.gameId ? games.find((item) => item.id === route.gameId) : undefined;

  useEffect(() => {
    if (!game || !route.levelId) {
      return;
    }

    markLevelViewed(game.id, route.levelId);
  }, [game, route.levelId]);

  if (!game) {
    return <HomePage onOpenGame={(gameId) => setRoute({ gameId })} />;
  }

  if (!route.levelId) {
    return (
      <LevelsPage
        game={game}
        onBack={() => setRoute({})}
        onOpenLevel={(levelId) => setRoute({ gameId: game.id, levelId })}
      />
    );
  }

  return (
    <game.Play
      game={game}
      levelId={route.levelId}
      onBack={() => setRoute({ gameId: game.id })}
      onOpenLevel={(nextLevelId) => setRoute({ gameId: game.id, levelId: nextLevelId })}
    />
  );
}

function HomePage({ onOpenGame }: { onOpenGame: (gameId: string) => void }) {
  return (
    <main class="app-shell">
      <header class="page-header">
        <div>
          <p class="eyebrow">Коллекция заданий</p>
          <h1>Развивающие игры</h1>
        </div>
      </header>

      <section class="game-grid" aria-label="Список игр">
        {games.map((game) => {
          const summary = getGameProgressSummary(game.id);

          return (
            <button class="game-tile" type="button" onClick={() => onOpenGame(game.id)} key={game.id}>
              <span class="game-icon" aria-hidden="true">
                {game.icon}
              </span>
              <span class="game-title">{game.title}</span>
              <span class="game-description">{game.description}</span>
              <span class="game-progress">
                Пройдено: {summary.completed} · Открыто: {summary.viewed}
              </span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

function LevelsPage({
  game,
  onBack,
  onOpenLevel,
}: {
  game: GamePlugin;
  onBack: () => void;
  onOpenLevel: (levelId: string) => void;
}) {
  const [levels, setLevels] = useState<DiscoveredLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    setIsLoading(true);
    setLevels([]);
    game
      .discoverLevels({
        onLevel: (level) => {
          if (alive) {
            setLevels((current) => [...current, level]);
          }
        },
      })
      .then((items) => {
        if (alive) {
          setLevels(items);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setLevels([]);
          setIsLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [game]);

  return (
    <main class="app-shell">
      <button class="text-button" type="button" onClick={onBack}>
        ← Все игры
      </button>
      <header class="page-header compact">
        <div>
          <p class="eyebrow">{game.title}</p>
          <h1>Выбери уровень</h1>
        </div>
      </header>

      {isLoading ? <p class="state-text">Ищем картинки...</p> : null}

      {!isLoading && levels.length === 0 ? (
        <p class="state-text">Пока нет уровней. Добавьте папки с картинками и обновите страницу.</p>
      ) : null}

      <section class="level-grid" aria-label="Список уровней">
        {levels.map((level, index) => {
          const status = getLevelStatus(game.id, level.id);
          const statusLabel = status === 'completed' ? 'Готово' : status === 'viewed' ? 'Открыт' : 'Новый';

          return (
            <button class={`level-tile ${status}`} type="button" onClick={() => onOpenLevel(level.id)} key={level.id}>
              <img src={level.previewUrl} alt="" style={{ aspectRatio: String(level.aspectRatio) }} />
              <span class="level-number">Уровень {index + 1}</span>
              <span class="level-count">{level.cards.length} картинок</span>
              <span class="level-status">{statusLabel}</span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

function useHashRoute(): [RouteState, (next: RouteState) => void] {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const route = useMemo(() => parseHash(hash), [hash]);

  const setRoute = (next: RouteState) => {
    if (!next.gameId) {
      window.location.hash = '#/';
      return;
    }

    if (!next.levelId) {
      window.location.hash = `#/game/${encodeURIComponent(next.gameId)}`;
      return;
    }

    window.location.hash = `#/game/${encodeURIComponent(next.gameId)}/level/${encodeURIComponent(next.levelId)}`;
  };

  return [route, setRoute];
}

function parseHash(hash: string): RouteState {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  if (parts[0] !== 'game' || !parts[1]) {
    return {};
  }

  if (parts[2] === 'level' && parts[3]) {
    return {
      gameId: decodeURIComponent(parts[1]),
      levelId: decodeURIComponent(parts[3]),
    };
  }

  return {
    gameId: decodeURIComponent(parts[1]),
  };
}
