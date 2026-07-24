/**
 * High-Octane Gamified Synthesizer using Web Audio API
 * Provides custom 8-bit sound effects & haptic coordinate feedback.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  // Resume if suspended (browsers auto-suspend audio context until user interaction)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * 🪙 Classic Retro Gamified Gold Ammo "Coin Ding" sound
 */
export function playCoinSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // First high note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now); // B5 note
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second higher note shortly after for that signature coin "ding"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6 note
    gain2.gain.setValueAtTime(0.0, now);
    gain2.gain.setValueAtTime(0.08, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);
  } catch (error) {
    console.warn('Web Audio Coin Sound Failed', error);
  }
}

/**
 * 🎯 Satisfying contract confirmation click/chirp
 */
export function playConfirmSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // slides up to A5
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {
    console.warn('Web Audio Confirm Sound Failed', e);
  }
}

/**
 * 🚨 Pulse Alert - Radar radar pulse alert for Urgent Bounties
 */
export function playUrgentRadarSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(300, now + 0.25);
    
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (e) {
    console.warn('Web Audio Radar Sound Failed', e);
  }
}

/**
 * 📱 Browser haptic vibration wrapper with visual pulse callback simulation
 */
export function triggerHaptic(strength: 'soft' | 'sharp', enabled: boolean = true) {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (strength === 'soft') {
        navigator.vibrate(15);
      } else {
        navigator.vibrate([25, 40, 25]);
      }
    } catch (e) {
      // safe ignore block
    }
  }

  // Trigger a subtle console visual trace for debugging on browser devices
  console.log(`[HAPTIC TRIGGER] ${strength === 'soft' ? '⌁ Soft vibration pulse' : '🔀 Sharp double vibration pulse'}`);
}

/**
 * 🔊 Navigation Tab Tap Sound: Ultra-short, soft electronic click
 */
export function playSoftClick(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {
    console.warn('Soft click synthesis failed', e);
  }
}

/**
 * 🔊 Mechanical Lock and Load Coins: Low mechanical lock thump + cash coins chime
 */
export function playLockAndLoadCoins(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // First mechanical clank thump
    const clank1 = ctx.createOscillator();
    const gainClank1 = ctx.createGain();
    clank1.type = 'triangle';
    clank1.frequency.setValueAtTime(120, now);
    clank1.frequency.linearRampToValueAtTime(50, now + 0.07);
    gainClank1.gain.setValueAtTime(0.12, now);
    gainClank1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    clank1.connect(gainClank1);
    gainClank1.connect(ctx.destination);
    clank1.start(now);
    clank1.stop(now + 0.08);

    // Second mechanical clank slider lock at t = 0.08s
    const clank2 = ctx.createOscillator();
    const gainClank2 = ctx.createGain();
    clank2.type = 'sawtooth';
    clank2.frequency.setValueAtTime(150, now + 0.08);
    clank2.frequency.linearRampToValueAtTime(70, now + 0.16);
    gainClank2.gain.setValueAtTime(0.0, now);
    gainClank2.gain.setValueAtTime(0.08, now + 0.08);
    gainClank2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    clank2.connect(gainClank2);
    gainClank2.connect(ctx.destination);
    clank2.start(now + 0.08);
    clank2.stop(now + 0.17);

    // Dynamic cash register double-coin ring starting at t = 0.2s
    const coinNow = now + 0.20;
    
    const coin1 = ctx.createOscillator();
    const gainCoin1 = ctx.createGain();
    coin1.type = 'sine';
    coin1.frequency.setValueAtTime(1046.50, coinNow); // C6 Note
    gainCoin1.gain.setValueAtTime(0.0, now);
    gainCoin1.gain.setValueAtTime(0.08, coinNow);
    gainCoin1.gain.exponentialRampToValueAtTime(0.001, coinNow + 0.24);
    coin1.connect(gainCoin1);
    gainCoin1.connect(ctx.destination);
    coin1.start(coinNow);
    coin1.stop(coinNow + 0.28);

    const coin2 = ctx.createOscillator();
    const gainCoin2 = ctx.createGain();
    coin2.type = 'sine';
    coin2.frequency.setValueAtTime(1318.51, coinNow + 0.07); // E6 Note
    gainCoin2.gain.setValueAtTime(0.0, now);
    gainCoin2.gain.setValueAtTime(0.08, coinNow + 0.07);
    gainCoin2.gain.exponentialRampToValueAtTime(0.001, coinNow + 0.32);
    coin2.connect(gainCoin2);
    gainCoin2.connect(ctx.destination);
    coin2.start(coinNow + 0.07);
    coin2.stop(coinNow + 0.37);

  } catch (e) {
    console.warn('Lock & load coins synthesis failed', e);
  }
}

/**
 * 🔊 Camera Shutter Sound: Sharp double physical blade slap click
 */
export function playCameraShutter(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    
    // Blade 1 Opening
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(2600, now);
    osc1.frequency.exponentialRampToValueAtTime(900, now + 0.04);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // Blade 2 Closing at t = 0.04s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1200, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(500, now + 0.09);
    gain2.gain.setValueAtTime(0.0, now);
    gain2.gain.setValueAtTime(0.08, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.10);

  } catch (e) {
    console.warn('Camera shutter synthesis failed', e);
  }
}

/**
 * 🔊 Post New Bounty Success: Upbeat, rising cybernetic broadcast chime
 */
export function playQuestBroadcast(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.setValueAtTime(0.05, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.40);
    });
  } catch (e) {
    console.warn('Quest broadcast synthesis failed', e);
  }
}

/**
 * 🔊 System Alert / Double Buzz Sound: Warning feedback
 */
export function playSystemError(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    
    // First Buzz
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(105, now);
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(400, now);
    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    
    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second Buzz at t = 0.16s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter2 = ctx.createBiquadFilter();
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(105, now + 0.16);
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(400, now + 0.16);
    gain2.gain.setValueAtTime(0.0, now);
    gain2.gain.setValueAtTime(0.09, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    
    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.31);

  } catch (e) {
    console.warn('System error synthesis failed', e);
  }
}

/**
 * 🔊 Captain Arrival Alert Chime: Upbeat, beautiful quadruple chime representing successful arrival
 */
export function playArrivalChime(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Chime notes: F#5 (739.99 Hz), A#5 (932.33 Hz), C#6 (1109.73 Hz), F#6 (1479.98 Hz)
    const notes = [739.99, 932.33, 1109.73, 1479.98];
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.10;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.50);
    });
  } catch (e) {
    console.warn('Arrival chime synthesis failed', e);
  }
}

/**
 * 🔔 Distinct Notification Alert Sound: Crisp 3-note ascending chime (G5, C6, E6)
 */
export function playNotificationSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Ascending crisp bell chime: G5 (783.99 Hz) -> C6 (1046.50 Hz) -> E6 (1318.51 Hz)
    const notes = [783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.40);
    });
  } catch (e) {
    console.warn('Notification sound synthesis failed', e);
  }
}

