import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadImageInfo, makeRuntimeAssetUrl } from '../../runtimeAssets';
import { clampZoom, getGameZoom, markLevelCompleted, setGameZoom } from '../../storage';
import type { DiscoveredLevel, GamePlugin, RuntimeCard } from '../../types';
import { playFailedStepSound, playLevelCompleteSound, playSuccessStepSound } from './sounds';

const gameId = 'order-cards';
const levelsRoot = 'games/order-cards/levels';
const maxLevels = 9999;
const maxCards = 99;
const cardFilenameWidths = [1, 2, 3, 4];

export const orderCardsGame: GamePlugin = {
  id: gameId,
  title: 'Назови в правильном порядке',
  description: 'Нажимай картинки по порядку и собирай правильный ряд.',
  icon: '123',
  progress: {
    persistPartialState: false,
  },
  discoverLevels,
  Play: OrderCardsPlay,
};

async function discoverLevels(): Promise<DiscoveredLevel[]> {
  const levels: DiscoveredLevel[] = [];

  for (let levelIndex = 1; levelIndex <= maxLevels; levelIndex += 1) {
    const levelId = formatNumber(levelIndex);
    const firstCard = await findFirstCard(levelId);

    if (!firstCard) {
      break;
    }

    const cards: RuntimeCard[] = [];

    for (let cardIndex = 1; cardIndex <= maxCards; cardIndex += 1) {
      const imageUrl = makeCardUrl(levelId, cardIndex, firstCard.filenameWidth);
      const imageInfo = cardIndex === 1 ? firstCard.imageInfo : await loadImageInfo(imageUrl);

      if (!imageInfo) {
        break;
      }

      cards.push({
        id: formatNumber(cardIndex),
        order: cardIndex,
        imageUrl,
        width: imageInfo.width,
        height: imageInfo.height,
      });
    }

    levels.push({
      id: levelId,
      title: `Уровень ${levelIndex}`,
      previewUrl: firstCard.imageUrl,
      aspectRatio: calculateLevelAspectRatio(cards),
      cards,
    });
  }

  return levels;
}

function OrderCardsPlay({
  game,
  levelId,
  onBack,
  onOpenLevel,
}: {
  game: GamePlugin;
  levelId: string;
  onBack: () => void;
  onOpenLevel: (levelId: string) => void;
}) {
  const [level, setLevel] = useState<DiscoveredLevel | null>(null);
  const [levels, setLevels] = useState<DiscoveredLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<RuntimeCard[]>([]);
  const [shakeCardId, setShakeCardId] = useState<string | null>(null);
  const [message, setMessage] = useState('Найди первую картинку.');
  const [restartSeed, setRestartSeed] = useState(() => Math.random());
  const [movingCard, setMovingCard] = useState<MovingCard | null>(null);
  const [zoom, setZoom] = useState(() => getGameZoom(gameId));
  const sourceRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const choiceRowRef = useRef<HTMLDivElement | null>(null);
  const pendingLayoutAnimation = useRef<Record<string, Box>>({});
  const pendingChoiceRowHeight = useRef<number | null>(null);
  const moveTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    setIsLoading(true);
    discoverLevels().then((levels) => {
      if (!alive) {
        return;
      }

      setLevels(levels);
      setLevel(levels.find((item) => item.id === levelId) ?? null);
      setSelected([]);
      setMovingCard(null);
      setMessage('Найди первую картинку.');
      setIsLoading(false);
    });

    return () => {
      alive = false;
      if (moveTimer.current) {
        window.clearTimeout(moveTimer.current);
      }
    };
  }, [levelId, restartSeed]);

  const shuffledCards = useMemo(() => {
    if (!level) {
      return [];
    }

    return shuffleCards(level.cards, `${level.id}-${restartSeed}`);
  }, [level, restartSeed]);

  const selectedIds = new Set(selected.map((card) => card.id));
  const remainingCards = shuffledCards.filter((card) => !selectedIds.has(card.id));
  const isComplete = level ? selected.length === level.cards.length : false;
  const currentLevelIndex = levels.findIndex((item) => item.id === levelId);
  const previousLevel = currentLevelIndex > 0 ? levels[currentLevelIndex - 1] : null;
  const nextLevel =
    currentLevelIndex >= 0 && currentLevelIndex < levels.length - 1 ? levels[currentLevelIndex + 1] : null;
  const canZoomOut = zoom > 0.9;
  const canZoomIn = zoom < 1.6;

  useLayoutEffect(() => {
    const previousRects = pendingLayoutAnimation.current;
    pendingLayoutAnimation.current = {};

    Object.entries(previousRects).forEach(([cardId, previousRect]) => {
      const element = sourceRefs.current[cardId];

      if (!element) {
        return;
      }

      const nextRect = element.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        {
          duration: 260,
          easing: 'cubic-bezier(0.2, 0.85, 0.25, 1)',
        },
      );
    });

    const previousHeight = pendingChoiceRowHeight.current;
    pendingChoiceRowHeight.current = null;

    if (previousHeight !== null) {
      const row = choiceRowRef.current;

      if (row) {
        const nextHeight = row.getBoundingClientRect().height;

        if (Math.abs(previousHeight - nextHeight) >= 1) {
          row.animate(
            [
              { minHeight: `${previousHeight}px` },
              { minHeight: `${nextHeight}px` },
            ],
            {
              duration: 260,
              easing: 'cubic-bezier(0.2, 0.85, 0.25, 1)',
            },
          );
        }
      }
    }
  }, [selected]);

  const changeZoom = (delta: number) => {
    const nextZoom = clampZoom(zoom + delta);
    setZoom(nextZoom);
    setGameZoom(game.id, nextZoom);
  };

  const onCardClick = (card: RuntimeCard) => {
    if (!level || isComplete || movingCard) {
      return;
    }

    const expectedOrder = selected.length + 1;

    if (card.order !== expectedOrder) {
      playFailedStepSound();
      setShakeCardId(card.id);
      setMessage('Почти! Эта картинка пока прыгает обратно.');
      window.setTimeout(() => setShakeCardId(null), 520);
      return;
    }

    const sourceRect = sourceRefs.current[card.id]?.getBoundingClientRect();
    const targetRect = slotRefs.current[card.id]?.getBoundingClientRect();
    const willCompleteLevel = selected.length + 1 === level.cards.length;
    const finishMove = () => {
      pendingLayoutAnimation.current = captureRemainingCardRects(card.id);
      pendingChoiceRowHeight.current = choiceRowRef.current?.getBoundingClientRect().height ?? null;
      const nextSelected = [...selected, card].sort((left, right) => left.order - right.order);
      setSelected(nextSelected);
      setMovingCard(null);

      if (nextSelected.length === level.cards.length) {
        markLevelCompleted(game.id, level.id);
        setMessage('Готово! Все картинки на местах.');
        return;
      }

      setMessage(`Отлично. Теперь найди картинку номер ${nextSelected.length + 1}.`);
    };

    if (willCompleteLevel) {
      playLevelCompleteSound();
    } else {
      playSuccessStepSound();
    }

    if (!sourceRect || !targetRect) {
      finishMove();
      return;
    }

    setMovingCard({
      id: card.id,
      imageUrl: card.imageUrl,
      from: rectToBox(sourceRect),
      to: rectToBox(targetRect),
    });

    moveTimer.current = window.setTimeout(finishMove, 360);
  };

  const captureRemainingCardRects = (removedCardId: string) => {
    return remainingCards.reduce<Record<string, Box>>((rects, remainingCard) => {
      if (remainingCard.id === removedCardId) {
        return rects;
      }

      const element = sourceRefs.current[remainingCard.id];

      if (element) {
        rects[remainingCard.id] = rectToBox(element.getBoundingClientRect());
      }

      return rects;
    }, {});
  };

  return (
    <main class="app-shell play-shell">
      <header class="play-header">
        <button class="text-button back-button" type="button" onClick={onBack}>
          ← Уровни
        </button>
        <div class="play-title">
          <p class="eyebrow">{game.title}</p>
          <h1>{level ? level.title : 'Уровень'}</h1>
        </div>
        <div class="play-actions">
          <button
            class="icon-button"
            type="button"
            disabled={!previousLevel}
            onClick={() => previousLevel && onOpenLevel(previousLevel.id)}
            aria-label="Предыдущий уровень"
            title="Предыдущий уровень"
          >
            ←
          </button>
          <button class="secondary-button" type="button" onClick={() => setRestartSeed(Math.random())}>
            Сначала
          </button>
          <button
            class="icon-button zoom-button"
            type="button"
            disabled={!canZoomOut}
            onClick={() => changeZoom(-0.1)}
            aria-label="Уменьшить"
            title="Уменьшить"
          >
            <span class="zoom-icon" aria-hidden="true">
              -
            </span>
          </button>
          <button
            class="icon-button zoom-button"
            type="button"
            disabled={!canZoomIn}
            onClick={() => changeZoom(0.1)}
            aria-label="Увеличить"
            title="Увеличить"
          >
            <span class="zoom-icon" aria-hidden="true">
              +
            </span>
          </button>
          <button
            class="icon-button"
            type="button"
            disabled={!nextLevel}
            onClick={() => nextLevel && onOpenLevel(nextLevel.id)}
            aria-label="Следующий уровень"
            title="Следующий уровень"
          >
            →
          </button>
        </div>
      </header>

      {isLoading ? <p class="state-text">Готовим картинки...</p> : null}

      {!isLoading && !level ? <p class="state-text">Уровень не найден.</p> : null}

      {level ? (
        <section
          class={`task-board ${isComplete ? 'celebrating' : ''}`}
          style={{ '--game-zoom': String(zoom), '--card-aspect-ratio': String(level.aspectRatio) }}
          aria-live="polite"
        >
          {isComplete ? <Celebration /> : null}
          <div class={`message-strip ${isComplete ? 'complete' : ''}`}>{message}</div>

          <div class="card-row answer-row" aria-label="Правильный ряд">
            {level.cards.map((card, index) => {
              const placed = selected.find((item) => item.id === card.id);

              return placed ? (
                <CardButton card={placed} disabled key={card.id} />
              ) : (
                <div
                  class="card-slot"
                  ref={(node) => {
                    slotRefs.current[card.id] = node;
                  }}
                  key={card.id}
                >
                  {index + 1}
                </div>
              );
            })}
          </div>

          {!isComplete ? (
            <div class="card-row" ref={choiceRowRef} aria-label="Картинки для выбора">
              {remainingCards.map((card) => (
                <CardButton
                  card={card}
                  isShaking={shakeCardId === card.id}
                  isMoving={movingCard?.id === card.id}
                  onClick={() => onCardClick(card)}
                  setRef={(node) => {
                    sourceRefs.current[card.id] = node;
                  }}
                  key={card.id}
                />
              ))}
            </div>
          ) : null}

          {movingCard ? <MovingCardOverlay card={movingCard} /> : null}
        </section>
      ) : null}
    </main>
  );
}

function Celebration() {
  const pieces = [
    ['12%', '10%', '#ffcf5a', '0ms', '18deg'],
    ['24%', '4%', '#7bdcb5', '160ms', '-12deg'],
    ['38%', '12%', '#88c0d0', '260ms', '22deg'],
    ['52%', '5%', '#ff9aa2', '90ms', '-18deg'],
    ['67%', '11%', '#b39ddb', '220ms', '14deg'],
    ['82%', '6%', '#80cbc4', '140ms', '-22deg'],
    ['18%', '24%', '#ffe082', '320ms', '30deg'],
    ['73%', '25%', '#f6a6c9', '360ms', '-28deg'],
  ];

  return (
    <div class="celebration-layer" aria-hidden="true">
      <div class="celebration-glow" />
      {pieces.map(([left, top, color, delay, rotate], index) => (
        <span
          class={`celebration-piece piece-${index % 3}`}
          style={{
            left,
            top,
            background: color,
            animationDelay: delay,
            transform: `rotate(${rotate})`,
          }}
          key={`${left}-${top}`}
        />
      ))}
      <span class="celebration-ribbon ribbon-left" />
      <span class="celebration-ribbon ribbon-right" />
    </div>
  );
}

function CardButton({
  card,
  disabled,
  isShaking,
  isMoving,
  onClick,
  setRef,
}: {
  card: RuntimeCard;
  disabled?: boolean;
  isShaking?: boolean;
  isMoving?: boolean;
  onClick?: () => void;
  setRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      class={`picture-card ${isShaking ? 'shake' : ''} ${isMoving ? 'moving-source' : ''}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
      ref={setRef}
      aria-label={`Картинка ${card.order}`}
    >
      <img src={card.imageUrl} alt="" draggable={false} />
    </button>
  );
}

function MovingCardOverlay({ card }: { card: MovingCard }) {
  const deltaX = card.to.left - card.from.left;
  const deltaY = card.to.top - card.from.top;
  const scaleX = card.to.width / card.from.width;
  const scaleY = card.to.height / card.from.height;

  return (
    <div
      class="moving-card"
      style={{
        left: `${card.from.left}px`,
        top: `${card.from.top}px`,
        width: `${card.from.width}px`,
        height: `${card.from.height}px`,
        '--move-x': `${deltaX}px`,
        '--move-y': `${deltaY}px`,
        '--scale-x': String(scaleX),
        '--scale-y': String(scaleY),
      }}
      aria-hidden="true"
    >
      <img src={card.imageUrl} alt="" />
    </div>
  );
}

async function findFirstCard(levelId: string) {
  for (const filenameWidth of cardFilenameWidths) {
    const imageUrl = makeCardUrl(levelId, 1, filenameWidth);
    const imageInfo = await loadImageInfo(imageUrl);

    if (imageInfo) {
      return {
        filenameWidth,
        imageUrl,
        imageInfo,
      };
    }
  }

  return null;
}

function makeCardUrl(levelId: string, cardIndex: number, filenameWidth: number) {
  return makeRuntimeAssetUrl(`${levelsRoot}/${levelId}/${formatNumber(cardIndex, filenameWidth)}.jpg`);
}

function calculateLevelAspectRatio(cards: RuntimeCard[]) {
  if (!cards.length) {
    return 4 / 3;
  }

  const averageRatio =
    cards.reduce((total, card) => {
      return total + card.width / card.height;
    }, 0) / cards.length;

  return Math.min(Math.max(averageRatio, 0.55), 2.2);
}

function formatNumber(value: number, width = 4) {
  return value.toString().padStart(width, '0');
}

function shuffleCards(cards: RuntimeCard[], seed: string) {
  const next = [...cards];
  let state = hashString(seed);

  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

type MovingCard = {
  id: string;
  imageUrl: string;
  from: Box;
  to: Box;
};

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function rectToBox(rect: DOMRect): Box {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
