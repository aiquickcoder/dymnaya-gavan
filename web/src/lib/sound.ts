// Ленивый Web Audio «звоночек» для уведомлений о новых вызовах (zero-dep, без
// аудио-файлов и внешних либ). AudioContext создаётся при первом playBeep() и
// переиспользуется. Из-за autoplay-политик браузеров контекст может стартовать в
// состоянии "suspended" — тогда пробуем resume(). Функция НИКОГДА не бросает: если
// Web Audio недоступен (старый браузер, заблокирован), звук просто не проигрывается.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * Короткий двухнотный сигнал (A5 → D6) — приятный, не резкий «динь-динь».
 * Каждый тон — свой oscillator с плавной ADSR-огибающей через gain, чтобы не было
 * щелчков. Безопасно вызывать сколько угодно раз.
 */
export function playBeep(): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    const now = ac.currentTime;

    const tone = (freq: number, at: number, dur: number, peak: number) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ac.destination);
      const t0 = now + at;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    };

    tone(880, 0, 0.13, 0.13); // A5
    tone(1174.66, 0.11, 0.17, 0.11); // D6
  } catch {
    /* Web Audio недоступен — тихо игнорируем, звук не критичен. */
  }
}
