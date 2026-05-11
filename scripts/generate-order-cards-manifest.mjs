import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const levelsRoot = join(root, 'public/games/order-cards/levels');
const outputPath = join(root, 'src/games/order-cards/manifest.generated.ts');
const cardFilenameWidths = [1, 2, 3, 4];
const maxCards = 99;

const levels = readLevelFolders().map((levelId, levelIndex) => {
  const firstCard = findFirstCard(levelId);

  if (!firstCard) {
    return null;
  }

  const cards = [];

  for (let cardIndex = 1; cardIndex <= maxCards; cardIndex += 1) {
    const fileName = `${formatNumber(cardIndex, firstCard.filenameWidth)}.jpg`;
    const filePath = join(levelsRoot, levelId, fileName);

    if (!existsFile(filePath)) {
      break;
    }

    const size = readJpegSize(filePath);
    const imageUrl = toRuntimePath(filePath);

    cards.push({
      id: formatNumber(cardIndex),
      order: cardIndex,
      imageUrl,
      width: size.width,
      height: size.height,
    });
  }

  return {
    id: levelId,
    title: `Уровень ${levelIndex + 1}`,
    previewUrl: firstCard.imageUrl,
    aspectRatio: calculateLevelAspectRatio(cards),
    cards,
  };
}).filter(Boolean);

writeFileSync(
  outputPath,
  `import type { DiscoveredLevel } from '../../types';\n\nexport const orderCardsManifest = ${JSON.stringify(
    levels,
    null,
    2,
  )} satisfies DiscoveredLevel[];\n`,
);

function readLevelFolders() {
  try {
    return readdirSync(levelsRoot)
      .filter((name) => existsDirectory(join(levelsRoot, name)) && /^\d+$/.test(name))
      .sort((left, right) => Number(left) - Number(right));
  } catch {
    return [];
  }
}

function findFirstCard(levelId) {
  for (const filenameWidth of cardFilenameWidths) {
    const filePath = join(levelsRoot, levelId, `${formatNumber(1, filenameWidth)}.jpg`);

    if (existsFile(filePath)) {
      return {
        filenameWidth,
        imageUrl: toRuntimePath(filePath),
      };
    }
  }

  return null;
}

function toRuntimePath(filePath) {
  return relative(join(root, 'public'), filePath).replaceAll('\\', '/');
}

function calculateLevelAspectRatio(cards) {
  if (!cards.length) {
    return 4 / 3;
  }

  const averageRatio = cards.reduce((total, card) => total + card.width / card.height, 0) / cards.length;
  return Math.min(Math.max(averageRatio, 0.55), 2.2);
}

function formatNumber(value, width = 4) {
  return value.toString().padStart(width, '0');
}

function existsFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function existsDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readJpegSize(path) {
  const buffer = readFileSync(path);
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  throw new Error(`Could not read JPEG size: ${path}`);
}
