interface Section {
  name: string;
  len: number;
}

interface SectionInfo {
  name: string;
  pos: number;
  len: number;
}

const MusicEngine = (() => {
  let ctx: AudioContext | null = null;
  let playing = false;
  let gainNode: GainNode | null = null;
  let compressor: DynamicsCompressorNode | null = null;
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;
  let nextNoteTime = 0;
  let step = 0;

  const START_BPM = 150;
  const END_BPM = 260;
  const MUSIC_DURATION = 60;
  let stepDur = 60 / START_BPM / 2;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let gameStartCtxTime = 0;

  const N: Record<string, number> = {};
  "C Db D Eb E F Gb G Ab A Bb B".split(" ").forEach((name, i) => {
    for (let oct = 1; oct <= 7; oct++) {
      N[name + oct] = 32.703 * Math.pow(2, i / 12 + (oct - 1));
    }
  });

  const SECTIONS: Section[] = [
    { name: "intro", len: 16 },
    { name: "verse", len: 64 },
    { name: "pre", len: 32 },
    { name: "chorus", len: 64 },
    { name: "verse2", len: 64 },
    { name: "break", len: 32 },
    { name: "build", len: 32 },
    { name: "solo", len: 64 },
    { name: "final", len: 96 },
    { name: "outro", len: 16 },
  ];
  const TOTAL = SECTIONS.reduce((s, x) => s + x.len, 0);
  const INTRO_LEN = SECTIONS[0].len;

  function getSection(g: number): SectionInfo {
    const s = g < TOTAL ? g : INTRO_LEN + ((g - TOTAL) % (TOTAL - INTRO_LEN));
    let acc = 0;
    for (const sec of SECTIONS) {
      if (s < acc + sec.len)
        return { name: sec.name, pos: s - acc, len: sec.len };
      acc += sec.len;
    }
    return { name: "verse", pos: 0, len: 64 };
  }

  function chordAt(name: string, pos: number): string[] {
    const VERSE = [["A","C","E"],["F","A","C"],["C","E","G"],["G","B","D"]];
    const CHORUS = [["A","C","E"],["D","F","A"],["F","A","C"],["E","Ab","B"]];
    const BRIDGE = [["F","A","C"],["G","B","D"],["A","C","E"],["E","Ab","B"]];
    const SOLO = [["A","C","E"],["C","E","G"],["F","A","C"],["G","B","D"]];
    let prog: string[][];
    switch (name) {
      case "chorus": case "final": prog = CHORUS; break;
      case "break": case "build": prog = BRIDGE; break;
      case "solo": prog = SOLO; break;
      default: prog = VERSE;
    }
    return prog[(pos >> 3) % prog.length];
  }

  const ARP_UP = [0,0,0,1,1,1,2,2];
  const ARP_DOWN = [2,2,1,1,1,0,0,0];
  const ARP_BOUNCE = [0,1,2,1,0,2,1,0];
  const ARP_FAST = [0,1,2,0,1,2,0,2];
  const ARP_WILD = [0,2,1,0,2,0,1,2];

  function arpNote(chord: string[], pattern: number[], idx: number, baseOct: number): number {
    const ci = pattern[idx % pattern.length];
    return N[chord[ci] + baseOct] || 0;
  }

  const LEAD_VERSE = ["A5","0","C6","B5","A5","0","E5","0","D5","F5","A5","0","G5","E5","0","0"];
  const LEAD_PRE = ["E5","E5","A5","A5","B5","C6","C6","B5","A5","A5","E5","E5","D5","E5","F5","G5"];
  const LEAD_CHOR = ["A5","C6","E6","E6","C6","A5","E5","A5","D5","F5","A5","D6","A5","F5","E6","A5"];
  const LEAD_CHOR2 = ["E6","D6","C6","A5","C6","E6","A5","C6","F5","A5","D6","A5","E5","A5","C6","E6"];
  const LEAD_SOLO1 = ["A5","C6","E6","D6","C6","E6","A5","B5","C6","D6","E6","C6","A5","G5","A5","B5"];
  const LEAD_SOLO2 = ["E6","D6","C6","B5","A5","B5","C6","D6","E6","Eb6","D6","C6","B5","A5","Ab5","A5"];
  const LEAD_SOLO3 = ["A5","E6","C6","A5","D6","A5","F5","A5","E6","B5","G5","E5","A5","C6","E6","A6"];
  const LEAD_BRIDGE = ["F5","A5","C6","A5","G5","B5","D6","B5","A5","C6","E6","C6","E5","Ab5","B5","E5"];

  function bassNote(chord: string[], idx: number, name: string): number {
    const root = chord[0];
    const fifth = chord[2];
    if (name === "chorus" || name === "final") {
      const pat = [root,root,root,fifth,root,root,fifth,root,root,root,root,fifth,root,fifth,root,root];
      return N[pat[idx % 16] + "2"] || 0;
    }
    if (name === "solo") {
      const pat = [root,root,fifth,root,root,fifth,root,fifth,root,root,root,fifth,root,root,fifth,root];
      return N[pat[idx % 16] + "2"] || 0;
    }
    const pat = [root,root,root,"0",root,"0",fifth,"0",root,root,root,"0",root,fifth,root,"0"];
    const n = pat[idx % 16];
    return n === "0" ? 0 : N[n + "2"] || 0;
  }

  const K_NONE = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  const K_FOUR = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0];
  const K_DRIV = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0];
  const K_PUNK = [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0];
  const S_NONE = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  const S_BACK = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0];
  const S_PUSH = [0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1];
  const S_ROLL = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
  const S_PUNK = [0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,1];
  const H_NONE = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  const H_8TH = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0];
  const H_16TH = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
  const TOM_PAT = [0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,1];

  function osc(freq: number, dur: number, type: OscillatorType, vol: number, time: number, detune: number) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(gainNode!);
    o.start(time); o.stop(time + dur);
  }

  function superSaw(freq: number, dur: number, vol: number, time: number) {
    const detunes = [-15, -7, 0, 7, 15];
    const each = vol / detunes.length;
    for (const d of detunes) osc(freq, dur, "sawtooth", each, time, d);
  }

  function riser(startFreq: number, endFreq: number, dur: number, vol: number, time: number) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(startFreq, time);
    o.frequency.exponentialRampToValueAtTime(endFreq, time + dur);
    g.gain.setValueAtTime(vol, time);
    g.gain.linearRampToValueAtTime(vol * 1.5, time + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g); g.connect(gainNode!);
    o.start(time); o.stop(time + dur);
  }

  function noise(dur: number, vol: number, time: number) {
    const bufSize = ctx!.sampleRate * dur;
    const buf = ctx!.createBuffer(1, bufSize, ctx!.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx!.createBufferSource();
    src.buffer = buf;
    const hp = ctx!.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 7000;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp); hp.connect(g); g.connect(gainNode!);
    src.start(time); src.stop(time + dur);
  }

  function kick(time: number, hard: boolean) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(hard ? 220 : 180, time);
    o.frequency.exponentialRampToValueAtTime(hard ? 20 : 30, time + 0.15);
    g.gain.setValueAtTime(hard ? 0.55 : 0.4, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    o.connect(g); g.connect(gainNode!);
    o.start(time); o.stop(time + 0.2);
    noise(0.02, hard ? 0.12 : 0.06, time);
  }

  function snare(time: number, loud: boolean) {
    osc(200, 0.05, "triangle", loud ? 0.2 : 0.12, time, 0);
    osc(340, 0.03, "square", loud ? 0.05 : 0, time, 0);
    noise(loud ? 0.12 : 0.08, loud ? 0.2 : 0.12, time);
  }

  function tom(time: number, pitch?: number) {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(pitch || 120, time);
    o.frequency.exponentialRampToValueAtTime(60, time + 0.12);
    g.gain.setValueAtTime(0.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    o.connect(g); g.connect(gainNode!);
    o.start(time); o.stop(time + 0.15);
  }

  function crash(time: number) { noise(0.4, 0.12, time); }

  function stab(chord: string[], oct: number, vol: number, time: number) {
    for (const note of chord) {
      const f = N[note + oct];
      if (f) {
        osc(f, stepDur * 0.3, "square", vol * 0.5, time, 0);
        osc(f, stepDur * 0.3, "sawtooth", vol * 0.4, time, 7);
        osc(f, stepDur * 0.3, "sawtooth", vol * 0.3, time, -7);
      }
    }
  }

  function scheduleStep(t: number) {
    const sec = getSection(step);
    const { name, pos, len } = sec;
    const s16 = pos % 16;
    const chord = chordAt(name, pos);
    const isHigh = name === "chorus" || name === "final" || name === "solo";
    const progress = pos / len;

    let kp = K_NONE, sp = S_NONE, hp2 = H_NONE, useTom = false, hardKick = false;
    let doCrash = false, doRiser = false;

    switch (name) {
      case "intro":
        kp = K_FOUR; hp2 = H_8TH; doCrash = pos === 0; break;
      case "verse":
        kp = K_FOUR; sp = S_BACK; hp2 = H_16TH; doCrash = pos === 0; break;
      case "pre":
        kp = K_PUNK; sp = S_BACK; hp2 = H_16TH;
        if (pos >= len - 8) { sp = S_ROLL; doRiser = pos === len - 8; }
        break;
      case "chorus":
        kp = K_DRIV; sp = S_PUSH; hp2 = H_16TH; hardKick = true; doCrash = pos === 0;
        if (pos >= len - 4) useTom = true;
        break;
      case "verse2":
        kp = K_PUNK; sp = S_PUSH; hp2 = H_16TH; doCrash = pos === 0; break;
      case "break":
        hp2 = pos < 16 ? H_8TH : H_16TH; kp = pos >= 16 ? K_FOUR : K_NONE; break;
      case "build":
        kp = K_DRIV; sp = pos >= 16 ? S_ROLL : S_BACK; hp2 = H_16TH; doRiser = pos === 0; break;
      case "solo":
        kp = K_DRIV; sp = S_PUNK; hp2 = H_16TH; hardKick = true;
        doCrash = pos === 0 || pos === 32;
        if (pos >= len - 4) useTom = true;
        break;
      case "final":
        kp = K_DRIV; sp = S_PUSH; hp2 = H_16TH; hardKick = true;
        doCrash = pos === 0 || pos === 32 || pos === 64;
        if (pos >= len - 6) { sp = S_ROLL; useTom = true; }
        break;
      case "outro":
        kp = K_FOUR; sp = pos < 8 ? S_BACK : S_NONE; hp2 = H_8TH; doCrash = pos === 0; break;
    }

    if (kp[s16]) kick(t, hardKick);
    if (sp[s16]) snare(t, isHigh);
    if (hp2[s16]) noise(0.025, isHigh ? 0.06 : 0.04, t);
    if (useTom && TOM_PAT[s16]) tom(t, 100 + (s16 % 4) * 30);
    if (doCrash && pos % 32 === 0) crash(t);
    if (doRiser) riser(200, 2000, stepDur * len * 0.25, 0.04, t);

    let arpPat: number[] | null, arpOct: number, arpVol: number, arpType: OscillatorType;
    switch (name) {
      case "intro":
        arpPat = ARP_UP; arpOct = 4; arpVol = 0.02 + progress * 0.03; arpType = "square";
        if (pos % 2 !== 0) arpPat = null; break;
      case "verse":
        arpPat = ARP_UP; arpOct = 4; arpVol = 0.04; arpType = "square"; break;
      case "pre":
        arpPat = ARP_BOUNCE; arpOct = 4; arpVol = 0.04 + progress * 0.03; arpType = "square"; break;
      case "chorus": case "final":
        arpPat = ARP_FAST; arpOct = 5; arpVol = 0.055; arpType = "square"; break;
      case "verse2":
        arpPat = ARP_DOWN; arpOct = 4; arpVol = 0.045; arpType = "square"; break;
      case "break":
        arpPat = ARP_UP; arpOct = 5; arpVol = 0.025; arpType = "triangle";
        if (pos % 2 !== 0) arpPat = null; break;
      case "build":
        arpPat = ARP_WILD; arpOct = 5; arpVol = 0.03 + progress * 0.04; arpType = "square"; break;
      case "solo":
        arpPat = ARP_FAST; arpOct = 5; arpVol = 0.05; arpType = "square"; break;
      case "outro":
        arpPat = ARP_UP; arpOct = 4; arpVol = 0.04 * (1 - progress); arpType = "triangle"; break;
      default:
        arpPat = ARP_UP; arpOct = 4; arpVol = 0.04; arpType = "square";
    }

    if (arpPat) {
      const freq = arpNote(chord, arpPat, pos, arpOct);
      if (freq > 0) {
        osc(freq, stepDur * 0.45, arpType, arpVol, t, 0);
        osc(freq, stepDur * 0.45, arpType, arpVol * 0.6, t, 12);
        if (isHigh) osc(freq / 2, stepDur * 0.4, "square", arpVol * 0.3, t, 0);
      }
    }

    if ((name === "chorus" || name === "final") && (s16 === 0 || s16 === 6 || s16 === 8 || s16 === 14)) {
      stab(chord, 4, 0.04, t);
    }
    if (name === "build" && s16 % 4 === 0) {
      stab(chord, 4, 0.02 + progress * 0.03, t);
    }

    if (pos % 2 === 0) {
      let ldArr: string[] | null = null, ldVol = 0.05, useSuperSaw = false;
      const li = ((pos / 2) | 0) % 16;
      switch (name) {
        case "verse": ldArr = LEAD_VERSE; ldVol = 0.04; break;
        case "pre": ldArr = LEAD_PRE; ldVol = 0.045; break;
        case "chorus":
          ldArr = pos < 32 ? LEAD_CHOR : LEAD_CHOR2; ldVol = 0.06; useSuperSaw = true; break;
        case "verse2": ldArr = LEAD_VERSE; ldVol = 0.045; break;
        case "break": ldArr = LEAD_BRIDGE; ldVol = 0.03; break;
        case "solo":
          ldArr = pos < 22 ? LEAD_SOLO1 : pos < 44 ? LEAD_SOLO2 : LEAD_SOLO3;
          ldVol = 0.07; useSuperSaw = true; break;
        case "final":
          ldArr = pos < 32 ? LEAD_CHOR : pos < 64 ? LEAD_CHOR2 : LEAD_SOLO3;
          ldVol = 0.065; useSuperSaw = true; break;
        case "outro": ldArr = LEAD_VERSE; ldVol = 0.03 * (1 - progress); break;
      }
      if (ldArr) {
        const noteStr = ldArr[li];
        if (noteStr !== "0" && N[noteStr]) {
          if (useSuperSaw) {
            superSaw(N[noteStr], stepDur * 1.6, ldVol, t);
          } else {
            osc(N[noteStr], stepDur * 1.8, "sawtooth", ldVol, t, 0);
            osc(N[noteStr] * 1.004, stepDur * 1.8, "sawtooth", ldVol * 0.6, t, 0);
          }
          if (isHigh) osc(N[noteStr] / 2, stepDur * 1.2, "square", ldVol * 0.3, t, 0);
        }
      }
    }

    if (isHigh && pos % 2 === 1) {
      const ci = (((pos - 1) / 2) | 0) % 8;
      const ctrNotes = ["E5","0","A5","0","C6","0","G5","0"];
      const cn = name === "solo"
        ? ["A5","C6","E6","0","D6","0","B5","0"][ci]
        : ctrNotes[ci];
      if (cn !== "0" && N[cn]) {
        osc(N[cn], stepDur * 0.35, "square", 0.025, t, 0);
      }
    }

    if (pos % 2 === 0) {
      const bi = ((pos / 2) | 0) % 16;
      let bVol = 0.1;
      let playBass = true;
      switch (name) {
        case "intro": bVol = 0.06; break;
        case "verse": case "verse2": bVol = 0.1; break;
        case "pre": bVol = 0.1 + progress * 0.04; break;
        case "chorus": case "final": bVol = 0.14; break;
        case "break": playBass = pos >= 16; bVol = 0.06; break;
        case "build": bVol = 0.08 + progress * 0.06; break;
        case "solo": bVol = 0.13; break;
        case "outro": bVol = 0.08 * (1 - progress); playBass = pos < 12; break;
      }
      if (playBass) {
        const bf = bassNote(chord, bi, name);
        if (bf > 0) {
          osc(bf, stepDur * 2.5, "sawtooth", bVol, t, 0);
          osc(bf, stepDur * 2.5, "square", bVol * 0.45, t, 0);
          osc(bf / 2, stepDur * 3, "sine", bVol * 0.8, t, 0);
        }
      }
    }

    step++;
  }

  function scheduler() {
    while (nextNoteTime < ctx!.currentTime + 0.1) {
      const elapsed = Math.min(nextNoteTime - gameStartCtxTime, MUSIC_DURATION);
      const progress = Math.max(0, Math.min(elapsed / MUSIC_DURATION, 1));
      const currentBPM = START_BPM + (END_BPM - START_BPM) * progress;
      stepDur = 60 / currentBPM / 2;
      scheduleStep(nextNoteTime);
      nextNoteTime += stepDur;
    }
  }

  return {
    start() {
      if (playing) return;
      if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      gainNode = ctx.createGain();
      gainNode.gain.value = 0.45;
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 6;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.1;
      gainNode.connect(compressor);
      compressor.connect(ctx.destination);
      step = 0;
      gameStartCtxTime = ctx.currentTime;
      nextNoteTime = ctx.currentTime;
      schedulerTimer = setInterval(scheduler, 25);
      playing = true;
    },
    stop() {
      if (!playing) return;
      clearInterval(schedulerTimer!);
      schedulerTimer = null;
      if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
      stepDur = 60 / START_BPM / 2;
      playing = false;
    },
    slowDown() {
      if (!ctx || !playing) return;
      clearInterval(schedulerTimer!);
      schedulerTimer = null;
      gainNode!.gain.cancelScheduledValues(ctx.currentTime);
      gainNode!.gain.setValueAtTime(0, ctx.currentTime);

      const now = ctx.currentTime;
      const scratchLen = 0.25;
      const bufSize = Math.floor(ctx.sampleRate * scratchLen);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const scratchSrc = ctx.createBufferSource();
      scratchSrc.buffer = buf;
      scratchSrc.playbackRate.setValueAtTime(2.0, now);
      scratchSrc.playbackRate.exponentialRampToValueAtTime(0.3, now + scratchLen);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 2000; bp.Q.value = 2;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.35, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + scratchLen);
      scratchSrc.connect(bp); bp.connect(sg); sg.connect(compressor!);
      scratchSrc.start(now); scratchSrc.stop(now + scratchLen);

      const toneO = ctx.createOscillator();
      const toneG = ctx.createGain();
      toneO.type = "sawtooth";
      toneO.frequency.setValueAtTime(800, now);
      toneO.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      toneG.gain.setValueAtTime(0.15, now);
      toneG.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      toneO.connect(toneG); toneG.connect(compressor!);
      toneO.start(now); toneO.stop(now + 0.3);

      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (!playing) return;
        gainNode!.gain.setValueAtTime(0.45, ctx!.currentTime);
        nextNoteTime = ctx!.currentTime;
        schedulerTimer = setInterval(scheduler, 25);
        resumeTimer = null;
      }, 700);
    },
    isPlaying() { return playing; },
  };
})();

export default MusicEngine;
