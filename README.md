# Развивающие игры

Offline-first static web app with small interactive tasks for children.

## Commands

```bash
npm run dev
npm run build:github
npm run build:standalone
```

- `github_build/` is the GitHub Pages output.
- `standalone_build/` is ignored by git and can be opened directly from disk with `index.html`.
- Runtime code and assets are local; the built app does not need internet access.

## Level Images

The first game, `Назови в правильном порядке`, loads levels by probing numbered image paths at runtime.

Put images here:

```text
public/games/order-cards/levels/0001/0001.jpg
public/games/order-cards/levels/0001/0002.jpg
public/games/order-cards/levels/0001/0003.jpg
public/games/order-cards/levels/0002/0001.jpg
```

Rules:

- level folders must be contiguous: `0001`, `0002`, `0003`
- image files inside each level must be contiguous: `0001.jpg`, `0002.jpg`, `0003.jpg`
- the correct click order is the numeric file order
- after a build, extra numbered level folders can also be added directly into the built `games/order-cards/levels/` folder and will appear after page reload

## Progress

Progress is stored in browser `localStorage`.

- `Новый`: untouched
- `Открыт`: level page was opened
- `Готово`: level was completed

Partial card placement is not stored for the first game.
