/**
 * One scroll listener for the whole application.
 *
 * Every parallax layer, camera rail and scroll-linked element subscribes here
 * instead of attaching its own listener. Reads are batched into a single
 * requestAnimationFrame tick, so N animated layers still cost one layout read
 * per frame rather than N.
 */

export type ScrollFrame = {
  /** Current window scrollY in px. */
  y: number;
  /** Viewport height in px. */
  vh: number;
  /** Viewport width in px. */
  vw: number;
};

type Subscriber = (frame: ScrollFrame) => void;

const subscribers = new Set<Subscriber>();
let frameHandle = 0;
let listening = false;

function readFrame(): ScrollFrame {
  return {
    y: window.scrollY || window.pageYOffset || 0,
    vh: window.innerHeight,
    vw: window.innerWidth,
  };
}

function flush() {
  frameHandle = 0;
  const frame = readFrame();
  for (const subscriber of subscribers) subscriber(frame);
}

function schedule() {
  if (frameHandle) return;
  frameHandle = requestAnimationFrame(flush);
}

function startListening() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
}

function stopListening() {
  if (!listening) return;
  listening = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  if (frameHandle) {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }
}

/**
 * Subscribe to scroll frames. Returns an unsubscribe function. The callback
 * fires once immediately so a layer can position itself before the first
 * user scroll.
 */
export function onScrollFrame(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  startListening();
  subscriber(readFrame());

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) stopListening();
  };
}

/**
 * How far an element has travelled through the viewport, as -1 → 1.
 *
 * -1 = the element's centre sits one viewport below the fold (not yet arrived),
 *  0 = centred in the viewport,
 *  1 = one viewport above (already left).
 * This is the input every camera-like transform is driven from.
 */
export function viewportProgress(rect: DOMRect, vh: number): number {
  const centre = rect.top + rect.height / 2;
  const progress = (centre - vh / 2) / vh;
  return Math.max(-1.5, Math.min(1.5, progress));
}
