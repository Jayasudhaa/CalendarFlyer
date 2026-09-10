/**
 * src/utils/sound.js
 * Subtle UI sound effects for primary actions across the admin app.
 *
 * Files are the CC0-licensed "minimal" pack from uisfx (see
 * public/sounds/LICENSE-AUDIO.txt) -- dry, quiet, almost-invisible tones
 * meant for productivity/SaaS UI, not games. Deliberately wired to a
 * *small* set of primary moments (nav clicks, a sheet/event/flyer/
 * broadcast finishing) rather than every click/toggle in the app, to
 * avoid noise fatigue.
 *
 * Each Audio() is cloned per play so rapid repeat clicks don't cut a
 * previous play off short. Playback failures (autoplay policy before any
 * user gesture, audio disabled, etc.) are swallowed on purpose -- a sound
 * effect should never break the action it's attached to.
 */

const SOUNDS = {
  click:    { src: '/sounds/click.mp3',    volume: 0.15 },
  success:  { src: '/sounds/success.mp3',  volume: 0.22 },
  complete: { src: '/sounds/complete.mp3', volume: 0.22 },
  send:     { src: '/sounds/send.mp3',     volume: 0.2  },
};

// One base <audio> element per cue, pre-created so the browser has the
// file decoded/cached before the first play -- cloneNode() on each actual
// play avoids re-fetching or waiting on a previous play to finish.
const base = {};
function getBase(name) {
  if (!base[name]) {
    const cfg = SOUNDS[name];
    const audio = new Audio(cfg.src);
    audio.preload = 'auto';
    audio.volume = cfg.volume;
    base[name] = audio;
  }
  return base[name];
}

function play(name) {
  try {
    const src = getBase(name);
    const node = src.cloneNode(true);
    node.volume = SOUNDS[name].volume;
    const p = node.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // Never let a sound effect break the action it's attached to.
  }
}

/** A primary nav/action button was clicked (Dashboard, Broadcast, Flyer, Add Event, ...). */
export const playClick = () => play('click');
/** A create/save action finished with the expected result (sheet created, event added). */
export const playSuccess = () => play('success');
/** A multi-step process reached its final state (flyer finished/saved). */
export const playComplete = () => play('complete');
/** Something was sent out (a broadcast went out to WhatsApp/Facebook/Instagram). */
export const playSend = () => play('send');
