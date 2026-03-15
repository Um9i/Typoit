export type SongId = "default" | "chill" | "boss";

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
  let stepDur = 60 / 150 / 2;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let gameStartCtxTime = 0;
  let activeSong: SongId = "default";

  const MUSIC_DURATION = 60;

  const N: Record<string, number> = {};
  "C Db D Eb E F Gb G Ab A Bb B".split(" ").forEach((name, i) => {
    for (let oct = 1; oct <= 7; oct++) {
      N[name + oct] = 32.703 * Math.pow(2, i / 12 + (oct - 1));
    }
  });

  // ── Shared audio primitives ────────────────────────────────────────

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

  function arpNote(chord: string[], pattern: number[], idx: number, baseOct: number): number {
    const ci = pattern[idx % pattern.length];
    return N[chord[ci] + baseOct] || 0;
  }

  // ══════════════════════════════════════════════════════════════════
  //  SONG: DEFAULT  (original punk/chiptune — A minor)
  // ══════════════════════════════════════════════════════════════════

  const DEF_START_BPM = 150;
  const DEF_END_BPM = 260;

  const DEF_SECTIONS: Section[] = [
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
  const DEF_TOTAL = DEF_SECTIONS.reduce((s, x) => s + x.len, 0);
  const DEF_INTRO = DEF_SECTIONS[0].len;

  function defGetSection(g: number): SectionInfo {
    const s = g < DEF_TOTAL ? g : DEF_INTRO + ((g - DEF_TOTAL) % (DEF_TOTAL - DEF_INTRO));
    let acc = 0;
    for (const sec of DEF_SECTIONS) {
      if (s < acc + sec.len) return { name: sec.name, pos: s - acc, len: sec.len };
      acc += sec.len;
    }
    return { name: "verse", pos: 0, len: 64 };
  }

  function defChordAt(name: string, pos: number): string[] {
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

  const LEAD_VERSE = ["A5","0","C6","B5","A5","0","E5","0","D5","F5","A5","0","G5","E5","0","0"];
  const LEAD_PRE = ["E5","E5","A5","A5","B5","C6","C6","B5","A5","A5","E5","E5","D5","E5","F5","G5"];
  const LEAD_CHOR = ["A5","C6","E6","E6","C6","A5","E5","A5","D5","F5","A5","D6","A5","F5","E6","A5"];
  const LEAD_CHOR2 = ["E6","D6","C6","A5","C6","E6","A5","C6","F5","A5","D6","A5","E5","A5","C6","E6"];
  const LEAD_SOLO1 = ["A5","C6","E6","D6","C6","E6","A5","B5","C6","D6","E6","C6","A5","G5","A5","B5"];
  const LEAD_SOLO2 = ["E6","D6","C6","B5","A5","B5","C6","D6","E6","Eb6","D6","C6","B5","A5","Ab5","A5"];
  const LEAD_SOLO3 = ["A5","E6","C6","A5","D6","A5","F5","A5","E6","B5","G5","E5","A5","C6","E6","A6"];
  const LEAD_BRIDGE = ["F5","A5","C6","A5","G5","B5","D6","B5","A5","C6","E6","C6","E5","Ab5","B5","E5"];

  function defBassNote(chord: string[], idx: number, name: string): number {
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

  function defStab(chord: string[], oct: number, vol: number, time: number) {
    for (const note of chord) {
      const f = N[note + oct];
      if (f) {
        osc(f, stepDur * 0.3, "square", vol * 0.5, time, 0);
        osc(f, stepDur * 0.3, "sawtooth", vol * 0.4, time, 7);
        osc(f, stepDur * 0.3, "sawtooth", vol * 0.3, time, -7);
      }
    }
  }

  function scheduleDefaultStep(t: number) {
    const sec = defGetSection(step);
    const { name, pos, len } = sec;
    const s16 = pos % 16;
    const chord = defChordAt(name, pos);
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
      defStab(chord, 4, 0.04, t);
    }
    if (name === "build" && s16 % 4 === 0) {
      defStab(chord, 4, 0.02 + progress * 0.03, t);
    }

    if (pos % 2 === 0) {
      let ldArr: string[] | null = null, ldVol = 0.05, useSS = false;
      const li = ((pos / 2) | 0) % 16;
      switch (name) {
        case "verse": ldArr = LEAD_VERSE; ldVol = 0.04; break;
        case "pre": ldArr = LEAD_PRE; ldVol = 0.045; break;
        case "chorus":
          ldArr = pos < 32 ? LEAD_CHOR : LEAD_CHOR2; ldVol = 0.06; useSS = true; break;
        case "verse2": ldArr = LEAD_VERSE; ldVol = 0.045; break;
        case "break": ldArr = LEAD_BRIDGE; ldVol = 0.03; break;
        case "solo":
          ldArr = pos < 22 ? LEAD_SOLO1 : pos < 44 ? LEAD_SOLO2 : LEAD_SOLO3;
          ldVol = 0.07; useSS = true; break;
        case "final":
          ldArr = pos < 32 ? LEAD_CHOR : pos < 64 ? LEAD_CHOR2 : LEAD_SOLO3;
          ldVol = 0.065; useSS = true; break;
        case "outro": ldArr = LEAD_VERSE; ldVol = 0.03 * (1 - progress); break;
      }
      if (ldArr) {
        const noteStr = ldArr[li];
        if (noteStr !== "0" && N[noteStr]) {
          if (useSS) {
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
        const bf = defBassNote(chord, bi, name);
        if (bf > 0) {
          osc(bf, stepDur * 2.5, "sawtooth", bVol, t, 0);
          osc(bf, stepDur * 2.5, "square", bVol * 0.45, t, 0);
          osc(bf / 2, stepDur * 3, "sine", bVol * 0.8, t, 0);
        }
      }
    }

    step++;
  }

  // ══════════════════════════════════════════════════════════════════
  //  SONG: CHILL  (relaxed lo-fi — C major, gentle & warm)
  // ══════════════════════════════════════════════════════════════════

  const CHL_START_BPM = 95;
  const CHL_END_BPM = 130;

  const CHL_SECTIONS: Section[] = [
    { name: "intro", len: 16 },
    { name: "verse", len: 64 },
    { name: "bridge", len: 32 },
    { name: "verse2", len: 64 },
    { name: "lift", len: 32 },
    { name: "chorus", len: 64 },
    { name: "verse3", len: 64 },
    { name: "outro", len: 16 },
  ];
  const CHL_TOTAL = CHL_SECTIONS.reduce((s, x) => s + x.len, 0);
  const CHL_INTRO = CHL_SECTIONS[0].len;

  function chlGetSection(g: number): SectionInfo {
    const s = g < CHL_TOTAL ? g : CHL_INTRO + ((g - CHL_TOTAL) % (CHL_TOTAL - CHL_INTRO));
    let acc = 0;
    for (const sec of CHL_SECTIONS) {
      if (s < acc + sec.len) return { name: sec.name, pos: s - acc, len: sec.len };
      acc += sec.len;
    }
    return { name: "verse", pos: 0, len: 64 };
  }

  function chlChordAt(name: string, pos: number): string[] {
    const VERSE = [["C","E","G"],["A","C","E"],["F","A","C"],["G","B","D"]];
    const BRIDGE = [["F","A","C"],["G","B","D"],["E","G","B"],["A","C","E"]];
    const CHORUS = [["C","E","G"],["G","B","D"],["A","C","E"],["F","A","C"]];
    let prog: string[][];
    switch (name) {
      case "bridge": case "lift": prog = BRIDGE; break;
      case "chorus": prog = CHORUS; break;
      default: prog = VERSE;
    }
    return prog[(pos >> 4) % prog.length];
  }

  const CHL_ARP_GENTLE = [0,1,2,1,0,1,2,1];
  const CHL_ARP_FLOAT = [0,2,1,0,2,1,0,2];

  const CHL_LEAD_V = ["C5","0","E5","0","G5","0","E5","0","F5","0","A5","0","G5","0","E5","0"];
  const CHL_LEAD_B = ["F5","0","A5","G5","E5","0","G5","0","A5","0","B5","A5","G5","0","E5","0"];
  const CHL_LEAD_C = ["C6","0","B5","A5","G5","0","E5","0","F5","G5","A5","0","G5","0","C6","0"];

  function scheduleChillStep(t: number) {
    const sec = chlGetSection(step);
    const { name, pos, len } = sec;
    const s16 = pos % 16;
    const chord = chlChordAt(name, pos);
    const progress = pos / len;
    const isChorus = name === "chorus";

    // Drums — gentle
    const doKick = name !== "intro" || pos >= 8;
    if (doKick && s16 % 8 === 0) kick(t, false);       // kick on 1 & 3 only
    if (name !== "intro" && name !== "outro" && (s16 === 4 || s16 === 12)) {
      // soft snare on 2 & 4
      noise(0.06, 0.06, t);
      osc(180, 0.04, "triangle", 0.06, t, 0);
    }
    // gentle hi-hat on 8ths
    if (name !== "intro" && s16 % 2 === 0) noise(0.015, 0.025, t);

    // Pad — warm sine chords, sustained
    if (pos % 16 === 0) {
      for (const note of chord) {
        const f = N[note + "4"];
        if (f) {
          osc(f, stepDur * 14, "sine", 0.018, t, 0);
          osc(f, stepDur * 14, "triangle", 0.012, t, 5);
        }
      }
    }

    // Arp — triangle, gentle
    const arpPat = isChorus ? CHL_ARP_FLOAT : CHL_ARP_GENTLE;
    if (pos % 2 === 0) {
      const freq = arpNote(chord, arpPat, pos, isChorus ? 5 : 4);
      if (freq > 0) {
        const av = isChorus ? 0.03 : 0.025;
        osc(freq, stepDur * 0.8, "triangle", av, t, 0);
        osc(freq, stepDur * 0.8, "sine", av * 0.5, t, 7);
      }
    }

    // Lead — sine/triangle melody
    if (pos % 2 === 0) {
      const li = ((pos / 2) | 0) % 16;
      let ldArr: string[] | null = null;
      let ldVol = 0.03;
      switch (name) {
        case "verse": case "verse2": case "verse3": ldArr = CHL_LEAD_V; ldVol = 0.03; break;
        case "bridge": case "lift": ldArr = CHL_LEAD_B; ldVol = 0.03; break;
        case "chorus": ldArr = CHL_LEAD_C; ldVol = 0.04; break;
        case "outro": ldArr = CHL_LEAD_V; ldVol = 0.025 * (1 - progress); break;
      }
      if (ldArr) {
        const noteStr = ldArr[li];
        if (noteStr !== "0" && N[noteStr]) {
          osc(N[noteStr], stepDur * 1.8, "triangle", ldVol, t, 0);
          osc(N[noteStr], stepDur * 1.8, "sine", ldVol * 0.7, t, 0);
        }
      }
    }

    // Bass — simple sine root notes
    if (pos % 4 === 0) {
      const root = chord[0];
      const bf = N[root + "3"];
      if (bf) {
        const bv = name === "outro" ? 0.06 * (1 - progress) : isChorus ? 0.09 : 0.07;
        osc(bf, stepDur * 3.5, "sine", bv, t, 0);
        osc(bf, stepDur * 3.5, "triangle", bv * 0.3, t, 0);
      }
    }

    step++;
  }

  // ══════════════════════════════════════════════════════════════════
  //  SONG: BOSS  (aggressive metal/EDM — E phrygian, intense)
  // ══════════════════════════════════════════════════════════════════

  const BOSS_START_BPM = 180;
  const BOSS_END_BPM = 310;

  const BOSS_SECTIONS: Section[] = [
    { name: "intro", len: 16 },
    { name: "buildup", len: 32 },
    { name: "drop", len: 64 },
    { name: "verse", len: 64 },
    { name: "pre", len: 32 },
    { name: "drop2", len: 64 },
    { name: "break", len: 32 },
    { name: "build", len: 32 },
    { name: "final", len: 96 },
    { name: "outro", len: 16 },
  ];
  const BOSS_TOTAL = BOSS_SECTIONS.reduce((s, x) => s + x.len, 0);
  const BOSS_INTRO = BOSS_SECTIONS[0].len;

  function bossGetSection(g: number): SectionInfo {
    const s = g < BOSS_TOTAL ? g : BOSS_INTRO + ((g - BOSS_TOTAL) % (BOSS_TOTAL - BOSS_INTRO));
    let acc = 0;
    for (const sec of BOSS_SECTIONS) {
      if (s < acc + sec.len) return { name: sec.name, pos: s - acc, len: sec.len };
      acc += sec.len;
    }
    return { name: "verse", pos: 0, len: 64 };
  }

  function bossChordAt(name: string, pos: number): string[] {
    const DARK = [["E","G","B"],["F","A","C"],["D","F","A"],["E","Ab","B"]];
    const DROP = [["E","G","B"],["Bb","D","F"],["A","C","E"],["E","Ab","B"]];
    const BRIDGE = [["A","C","E"],["Bb","D","F"],["G","Bb","D"],["E","Ab","B"]];
    let prog: string[][];
    switch (name) {
      case "drop": case "drop2": case "final": prog = DROP; break;
      case "break": case "build": prog = BRIDGE; break;
      default: prog = DARK;
    }
    return prog[(pos >> 3) % prog.length];
  }

  const BOSS_ARP_STAB = [0,2,1,2,0,2,1,0];
  const BOSS_ARP_RAGE = [0,1,2,2,1,0,2,1];
  const BOSS_ARP_TREM = [0,0,1,1,2,2,1,1];

  const BOSS_LEAD_V = ["E5","0","G5","Ab5","E5","0","B5","0","A5","G5","E5","0","Ab5","B5","0","E5"];
  const BOSS_LEAD_D = ["E6","D6","B5","E6","Ab5","B5","E6","D6","A5","B5","E6","0","D6","B5","Ab5","E5"];
  const BOSS_LEAD_F = ["E6","Ab6","B6","E6","D6","Ab5","B5","E6","A5","B5","D6","E6","Ab6","E6","B5","E5"];
  const BOSS_LEAD_BR = ["A5","0","Bb5","0","G5","0","E5","0","A5","Bb5","D6","0","E5","0","Ab5","0"];

  // Double-bass kick pattern
  const BK_DBL = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0];
  const BK_BLAST = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
  const BS_HEAVY = [0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,1];
  const BS_DOUBLE = [0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,0];

  function scheduleBossStep(t: number) {
    const sec = bossGetSection(step);
    const { name, pos, len } = sec;
    const s16 = pos % 16;
    const chord = bossChordAt(name, pos);
    const isDrop = name === "drop" || name === "drop2" || name === "final";
    const progress = pos / len;

    // Drums — aggressive
    let kp = K_NONE, sp = S_NONE, hp2 = H_NONE, useTom = false;
    let doCrash = false, doRiser = false;

    switch (name) {
      case "intro":
        hp2 = H_16TH; doCrash = pos === 0; doRiser = pos === 0; break;
      case "buildup":
        kp = K_FOUR; sp = progress > 0.5 ? BS_DOUBLE : S_BACK; hp2 = H_16TH;
        if (pos >= len - 8) { sp = S_ROLL; doRiser = pos === len - 8; }
        break;
      case "drop": case "drop2":
        kp = BK_DBL; sp = BS_HEAVY; hp2 = H_16TH; doCrash = pos === 0;
        if (pos >= len - 4) useTom = true;
        break;
      case "verse":
        kp = K_PUNK; sp = BS_DOUBLE; hp2 = H_16TH; doCrash = pos === 0; break;
      case "pre":
        kp = K_DRIV; sp = S_PUSH; hp2 = H_16TH;
        if (pos >= len - 8) { sp = S_ROLL; doRiser = pos === len - 8; }
        break;
      case "break":
        kp = pos >= 16 ? K_FOUR : K_NONE;
        hp2 = H_8TH; break;
      case "build":
        kp = BK_DBL; sp = pos >= 16 ? S_ROLL : BS_DOUBLE; hp2 = H_16TH;
        doRiser = pos === 0; break;
      case "final":
        kp = BK_BLAST; sp = BS_HEAVY; hp2 = H_16TH;
        doCrash = pos === 0 || pos === 32 || pos === 64;
        if (pos >= len - 8) { sp = S_ROLL; useTom = true; }
        break;
      case "outro":
        kp = K_FOUR; sp = pos < 8 ? BS_DOUBLE : S_NONE; hp2 = H_8TH;
        doCrash = pos === 0; break;
    }

    if (kp[s16]) kick(t, true);  // always hard kick for boss
    if (sp[s16]) snare(t, true);
    if (hp2[s16]) noise(0.02, isDrop ? 0.07 : 0.05, t);
    if (useTom && TOM_PAT[s16]) tom(t, 80 + (s16 % 4) * 40);
    if (doCrash && pos % 16 === 0) crash(t);
    if (doRiser) riser(150, 3000, stepDur * len * 0.3, 0.06, t);

    // Arps — aggressive square/sawtooth
    let arpPat: number[] | null, arpOct: number, arpVol: number, arpType: OscillatorType;
    switch (name) {
      case "intro":
        arpPat = BOSS_ARP_TREM; arpOct = 4; arpVol = 0.02 + progress * 0.04; arpType = "square";
        break;
      case "buildup":
        arpPat = BOSS_ARP_STAB; arpOct = 4; arpVol = 0.03 + progress * 0.04; arpType = "square"; break;
      case "drop": case "drop2":
        arpPat = BOSS_ARP_RAGE; arpOct = 5; arpVol = 0.06; arpType = "square"; break;
      case "verse":
        arpPat = BOSS_ARP_STAB; arpOct = 4; arpVol = 0.045; arpType = "square"; break;
      case "pre":
        arpPat = BOSS_ARP_TREM; arpOct = 5; arpVol = 0.04 + progress * 0.03; arpType = "square"; break;
      case "break":
        arpPat = BOSS_ARP_TREM; arpOct = 4; arpVol = 0.02; arpType = "triangle";
        if (pos % 2 !== 0) arpPat = null; break;
      case "build":
        arpPat = BOSS_ARP_RAGE; arpOct = 5; arpVol = 0.03 + progress * 0.05; arpType = "square"; break;
      case "final":
        arpPat = BOSS_ARP_RAGE; arpOct = 5; arpVol = 0.065; arpType = "square"; break;
      case "outro":
        arpPat = BOSS_ARP_TREM; arpOct = 4; arpVol = 0.04 * (1 - progress); arpType = "square"; break;
      default:
        arpPat = BOSS_ARP_STAB; arpOct = 4; arpVol = 0.04; arpType = "square";
    }

    if (arpPat) {
      const freq = arpNote(chord, arpPat, pos, arpOct);
      if (freq > 0) {
        osc(freq, stepDur * 0.35, arpType, arpVol, t, 0);
        osc(freq, stepDur * 0.35, arpType, arpVol * 0.7, t, 15);
        if (isDrop) {
          osc(freq / 2, stepDur * 0.3, "square", arpVol * 0.4, t, 0);
          osc(freq, stepDur * 0.35, "sawtooth", arpVol * 0.3, t, -10);
        }
      }
    }

    // Power stabs on drops
    if (isDrop && (s16 === 0 || s16 === 4 || s16 === 8 || s16 === 12)) {
      for (const note of chord) {
        const f = N[note + "4"];
        if (f) {
          superSaw(f, stepDur * 0.4, 0.025, t);
        }
      }
    }

    // Lead — supersaw on drops, sawtooth otherwise
    if (pos % 2 === 0) {
      const li = ((pos / 2) | 0) % 16;
      let ldArr: string[] | null = null;
      let ldVol = 0.06;
      let useSS = false;
      switch (name) {
        case "buildup": ldArr = BOSS_LEAD_V; ldVol = 0.04; break;
        case "verse": ldArr = BOSS_LEAD_V; ldVol = 0.05; break;
        case "pre": ldArr = BOSS_LEAD_V; ldVol = 0.05; break;
        case "drop": ldArr = BOSS_LEAD_D; ldVol = 0.07; useSS = true; break;
        case "drop2": ldArr = BOSS_LEAD_D; ldVol = 0.075; useSS = true; break;
        case "break": ldArr = BOSS_LEAD_BR; ldVol = 0.03; break;
        case "build": ldArr = BOSS_LEAD_V; ldVol = 0.04 + progress * 0.03; break;
        case "final":
          ldArr = pos < 48 ? BOSS_LEAD_D : BOSS_LEAD_F;
          ldVol = 0.08; useSS = true; break;
        case "outro": ldArr = BOSS_LEAD_V; ldVol = 0.04 * (1 - progress); break;
      }
      if (ldArr) {
        const noteStr = ldArr[li];
        if (noteStr !== "0" && N[noteStr]) {
          if (useSS) {
            superSaw(N[noteStr], stepDur * 1.4, ldVol, t);
            osc(N[noteStr] / 2, stepDur * 1.0, "square", ldVol * 0.4, t, 0);
          } else {
            osc(N[noteStr], stepDur * 1.6, "sawtooth", ldVol, t, 0);
            osc(N[noteStr] * 1.005, stepDur * 1.6, "sawtooth", ldVol * 0.5, t, 0);
          }
        }
      }
    }

    // Counter-melody on drops
    if (isDrop && pos % 2 === 1) {
      const ci = (((pos - 1) / 2) | 0) % 8;
      const ctr = ["E5","Ab5","B5","0","E6","0","D6","B5"];
      const cn = ctr[ci];
      if (cn !== "0" && N[cn]) {
        osc(N[cn], stepDur * 0.3, "square", 0.035, t, 0);
      }
    }

    // Bass — heavy and distorted
    if (pos % 2 === 0) {
      const bi = ((pos / 2) | 0) % 16;
      const root = chord[0];
      const fifth = chord[2];
      let bVol = 0.12;
      let playBass = true;
      switch (name) {
        case "intro": bVol = 0.06; playBass = pos >= 8; break;
        case "buildup": bVol = 0.08 + progress * 0.06; break;
        case "drop": case "drop2": bVol = 0.16; break;
        case "verse": bVol = 0.12; break;
        case "pre": bVol = 0.12 + progress * 0.04; break;
        case "break": playBass = pos >= 16; bVol = 0.06; break;
        case "build": bVol = 0.1 + progress * 0.08; break;
        case "final": bVol = 0.18; break;
        case "outro": bVol = 0.1 * (1 - progress); playBass = pos < 12; break;
      }
      if (playBass) {
        const pat = isDrop
          ? [root,root,root,fifth,root,fifth,root,root,root,root,fifth,root,root,fifth,root,root]
          : [root,root,root,"0",root,"0",fifth,"0",root,root,root,"0",root,fifth,root,"0"];
        const n = pat[bi % 16];
        if (n !== "0") {
          const bf = N[n + "2"] || 0;
          if (bf > 0) {
            osc(bf, stepDur * 2.0, "sawtooth", bVol, t, 0);
            osc(bf, stepDur * 2.0, "square", bVol * 0.6, t, 0);
            osc(bf / 2, stepDur * 2.5, "sine", bVol * 0.9, t, 0);
            if (isDrop) osc(bf, stepDur * 1.5, "sawtooth", bVol * 0.3, t, 12);
          }
        }
      }
    }

    step++;
  }

  // ══════════════════════════════════════════════════════════════════
  //  Song BPM configs
  // ══════════════════════════════════════════════════════════════════

  function getSongBPM(): { start: number; end: number } {
    switch (activeSong) {
      case "chill": return { start: CHL_START_BPM, end: CHL_END_BPM };
      case "boss": return { start: BOSS_START_BPM, end: BOSS_END_BPM };
      default: return { start: DEF_START_BPM, end: DEF_END_BPM };
    }
  }

  function activeScheduleStep(t: number) {
    switch (activeSong) {
      case "chill": scheduleChillStep(t); break;
      case "boss": scheduleBossStep(t); break;
      default: scheduleDefaultStep(t); break;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  Scheduler & public API
  // ══════════════════════════════════════════════════════════════════

  function scheduler() {
    const bpm = getSongBPM();
    while (nextNoteTime < ctx!.currentTime + 0.1) {
      const elapsed = Math.min(nextNoteTime - gameStartCtxTime, MUSIC_DURATION);
      const progress = Math.max(0, Math.min(elapsed / MUSIC_DURATION, 1));
      const currentBPM = bpm.start + (bpm.end - bpm.start) * progress;
      stepDur = 60 / currentBPM / 2;
      activeScheduleStep(nextNoteTime);
      nextNoteTime += stepDur;
    }
  }

  return {
    start(songId?: SongId) {
      if (playing) return;
      if (songId) activeSong = songId;
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
      const bpm = getSongBPM();
      stepDur = 60 / bpm.start / 2;
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
      const bpm = getSongBPM();
      stepDur = 60 / bpm.start / 2;
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
    setSong(songId: SongId) { activeSong = songId; },
  };
})();

export default MusicEngine;
