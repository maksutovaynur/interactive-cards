import { zzfx } from 'zzfx';

const muted = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function playSuccessStepSound() {
  play(() => {
    zzfx(0.16, 0, 540, 0.02, 0.08, 0.18, 1, 1.25, 0, 0, 90, 0.03, 0.02);
    window.setTimeout(() => zzfx(0.11, 0, 710, 0.02, 0.06, 0.12, 1, 1.2, 0, 0, 60, 0.02, 0.02), 65);
  });
}

export function playFailedStepSound() {
  play(() => {
    zzfx(0.12, 0, 210, 0.01, 0.04, 0.12, 1, 0.8, 0, 0, -25, 0.02, 0.01);
    window.setTimeout(() => zzfx(0.08, 0, 180, 0.01, 0.04, 0.1, 1, 0.75, 0, 0, -15, 0.02, 0.01), 80);
  });
}

export function playLevelCompleteSound() {
  play(() => {
    const notes = [440, 554, 659, 880];

    notes.forEach((frequency, index) => {
      window.setTimeout(() => {
        zzfx(0.14, 0, frequency, 0.02, 0.12, 0.24, 1, 1.35, 0, 0, 55, 0.04, 0.02);
      }, index * 105);
    });
  });
}

function play(callback: () => void) {
  if (muted) {
    return;
  }

  try {
    callback();
  } catch {
    // Sound is decorative; blocked audio should never break gameplay.
  }
}
