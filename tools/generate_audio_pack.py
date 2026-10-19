"""Generate the first FruitWoodWar audio pack with deterministic synthesis.

The generated files are intentionally simple source assets. They can ship as a
placeholder pack, or be replaced later by recorded/commissioned audio without
changing the event names used by the game.
"""
from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
ROOT = Path(__file__).resolve().parents[1] / "assets" / "resources" / "audio"
SFX = ROOT / "sfx"
MUSIC = ROOT / "music"
TAU = math.tau


def envelope(t: float, duration: float, attack: float = 0.008, release: float = 0.08) -> float:
    if t < 0 or t >= duration:
        return 0.0
    a = min(1.0, t / attack)
    r = min(1.0, (duration - t) / release)
    return a * r


def tone(freq: float, t: float, duration: float, shape: str = "sine", gain: float = 1.0) -> float:
    phase = TAU * freq * t
    if shape == "square":
        value = 1.0 if math.sin(phase) >= 0 else -1.0
    elif shape == "triangle":
        value = 2.0 * abs(2.0 * ((freq * t) % 1.0) - 1.0) - 1.0
    elif shape == "saw":
        value = 2.0 * ((freq * t) % 1.0) - 1.0
    else:
        value = math.sin(phase)
    return value * envelope(t, duration) * gain


def write_wav(path: Path, samples: list[float], channels: int = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = bytearray()
    if channels == 1:
        for value in samples:
            frames.extend(struct.pack("<h", int(max(-1, min(1, value)) * 32767)))
    else:
        for i in range(0, len(samples), 2):
            left, right = samples[i], samples[i + 1]
            frames.extend(struct.pack("<hh", int(max(-1, min(1, left)) * 32767), int(max(-1, min(1, right)) * 32767)))
    with wave.open(str(path), "wb") as stream:
        stream.setnchannels(channels)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes(frames)


def make_sfx(name: str, duration: float, fn) -> None:
    count = int(RATE * duration)
    write_wav(SFX / f"{name}.wav", [fn(i / RATE) for i in range(count)])


def build_sfx() -> None:
    make_sfx("ui_click", 0.06, lambda t: tone(920, t, 0.06, "sine", 0.32))
    make_sfx("build", 0.32, lambda t: tone(440, t, 0.10, "square", 0.24) + tone(660, t - 0.09, 0.10, "square", 0.22) + tone(880, t - 0.18, 0.12, "square", 0.20))
    make_sfx("upgrade", 0.42, lambda t: tone(520, t, 0.12, "sine", 0.24) + tone(780, t - 0.12, 0.14, "sine", 0.22) + tone(1040, t - 0.26, 0.16, "sine", 0.20))
    make_sfx("coin", 0.18, lambda t: tone(1175, t, 0.07, "sine", 0.24) + tone(1568, t - 0.06, 0.10, "sine", 0.20))
    make_sfx("card_confirm", 0.38, lambda t: tone(392, t, 0.10, "sine", 0.18) + tone(587, t - 0.10, 0.12, "sine", 0.18) + tone(784, t - 0.22, 0.14, "sine", 0.16))
    make_sfx("attack_light", 0.09, lambda t: tone(300, t, 0.09, "square", 0.15) + tone(1100, t, 0.035, "sine", 0.05))
    make_sfx("hit_heavy", 0.22, lambda t: tone(120, t, 0.20, "triangle", 0.34) + tone(70, t, 0.16, "saw", 0.12))
    make_sfx("siege_impact", 0.38, lambda t: tone(82, t, 0.32, "triangle", 0.38) + tone(164, t - 0.04, 0.18, "sine", 0.16))
    make_sfx("crystal_hit", 0.30, lambda t: tone(180, t, 0.22, "triangle", 0.24) + tone(920, t - 0.05, 0.18, "sine", 0.10))
    make_sfx("victory", 0.95, lambda t: tone(523, t, 0.18, "sine", 0.18) + tone(659, t - 0.18, 0.18, "sine", 0.18) + tone(784, t - 0.36, 0.20, "sine", 0.18) + tone(1047, t - 0.56, 0.34, "sine", 0.20))
    make_sfx("defeat", 0.75, lambda t: tone(440, t, 0.20, "triangle", 0.16) + tone(330, t - 0.20, 0.20, "triangle", 0.16) + tone(220, t - 0.40, 0.32, "triangle", 0.18))
    make_sfx("sudden_death", 0.90, lambda t: tone(196, t, 0.28, "saw", 0.16) + tone(293, t - 0.28, 0.22, "square", 0.14) + tone(392, t - 0.50, 0.36, "sine", 0.18))


def build_music() -> None:
    """16-bar, 100 BPM loop in C minor with a light cartoon percussion bed."""
    bpm = 100
    beat = 60.0 / bpm
    duration = beat * 4 * 16
    total = int(RATE * duration)
    chords = [(130.81, 155.56, 196.00), (146.83, 174.61, 220.00), (116.54, 138.59, 174.61), (98.00, 116.54, 146.83)]
    melody = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 392.00]
    rng = random.Random(19)
    out: list[float] = []
    for i in range(total):
        t = i / RATE
        bar = int(t / (beat * 4))
        chord = chords[bar % len(chords)]
        pulse = (t % (beat * 4)) / (beat * 4)
        pad = sum(math.sin(TAU * f * t) for f in chord) / 3.0 * 0.085
        note_index = int(t / (beat / 2)) % len(melody)
        note_t = t % (beat / 2)
        lead = tone(melody[note_index], note_t, beat * 0.42, "triangle", 0.13)
        bass = tone(chord[0] / 2, t % beat, beat * 0.65, "sine", 0.10)
        kick_phase = t % beat
        kick = math.sin(TAU * (90 - 45 * min(1.0, kick_phase / 0.12)) * kick_phase) * max(0.0, 1.0 - kick_phase / 0.18) * 0.16
        hat_phase = t % (beat / 2)
        hat = (rng.random() * 2 - 1) * max(0.0, 1.0 - hat_phase / 0.035) * 0.025
        value = pad + lead + bass + kick + hat
        fade = min(1.0, t / 0.5, (duration - t) / 0.5)
        out.extend((value * fade, value * fade * 0.96))
    write_wav(MUSIC / "battle_loop.wav", out, channels=2)


if __name__ == "__main__":
    build_sfx()
    build_music()
    print(f"generated {len(list(SFX.glob('*.wav')))} sfx + {len(list(MUSIC.glob('*.wav')))} music in {ROOT}")
