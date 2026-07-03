// Offscreen document: plays the success alert since the SW has no Audio API.
const SOUND_URL = browser.runtime.getURL('/sounds/alert.wav');

browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: string }).type === 'play-sound'
  ) {
    const audio = new Audio(SOUND_URL);
    void audio.play().catch((err) => {
      console.warn('[uz] offscreen audio play failed', err);
    });
  }
});
