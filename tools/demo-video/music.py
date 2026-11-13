"""Original light-jazz background loop, synthesised from scratch with numpy.

Electric piano comping a I-vi-ii-V in F, walking bass, brushes + ride cymbal,
and a few vibraphone notes. Swing eighths at a relaxed tempo.

    python3 music.py <seconds> <out.wav>
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 116
BEAT = 60 / BPM
SWING = 2 / 3  # the off-beat eighth lands 2/3 of the way through the beat
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, attack, decay):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(attack, 1e-4))
    return a * np.exp(-t * decay)


def epiano(freq, dur, vel):
    """Soft FM electric piano tone."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * t) * 1.2 * np.exp(-t * 5)
    tone = np.sin(2 * np.pi * freq * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 3)
    return tone * env(n, 0.004, 2.2) * vel


def bass(freq, dur, vel):
    n = int(dur * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) + 0.1 * np.sin(2 * np.pi * 3 * freq * t)
    return tone * env(n, 0.006, 3.5) * vel


def vibes(freq, dur, vel):
    n = int(dur * SR)
    t = np.arange(n) / SR
    trem = 1 + 0.25 * np.sin(2 * np.pi * 5.5 * t)
    tone = np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * 4 * freq * t) * np.exp(-t * 8)
    return tone * env(n, 0.002, 1.6) * trem * vel


def highpass(x, amount=0.97):
    y = np.empty_like(x)
    prev_x = prev_y = 0.0
    for i, v in enumerate(x):
        prev_y = amount * (prev_y + v - prev_x)
        prev_x = v
        y[i] = prev_y
    return y


NOISE = rng.standard_normal(SR)
HAT_NOISE = highpass(NOISE[: int(0.5 * SR)].copy(), 0.95)


def ride(vel):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    metal = sum(np.sin(2 * np.pi * f * t) for f in (3150, 4270, 5480, 6930)) / 4
    return (0.6 * HAT_NOISE[:n] + 0.4 * metal) * env(n, 0.001, 9) * vel


def brush(vel):
    n = int(0.3 * SR)
    swish = np.convolve(NOISE[:n], np.ones(12) / 12, mode="same")
    return swish * env(n, 0.03, 9) * vel


def kick(vel):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 50 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 14) * vel


# Chords (rootless-ish voicings, MIDI) and bass roots: Fmaj7 | Dm7 | Gm7 | C7
CHORDS = [
    ([57, 60, 64, 67], 41),  # Fmaj7: A C E G over F
    ([53, 57, 60, 64], 38),  # Dm9-ish: F A C E over D
    ([53, 58, 62, 65], 43),  # Gm7: F Bb D F over G
    ([52, 58, 62, 67], 36),  # C9: E Bb D G over C
]
SCALE = [65, 67, 69, 72, 74, 77, 79]  # F major pentatonic-ish for the vibes


def render(seconds):
    n = int(seconds * SR) + SR
    left = np.zeros(n)
    right = np.zeros(n)

    def place(sig, t, pan=0.0, gain=1.0):
        i = int(t * SR)
        if i >= n:
            return
        sig = sig[: n - i] * gain
        left[i : i + len(sig)] += sig * (1 - pan) / 2 * 2 ** 0.5
        right[i : i + len(sig)] += sig * (1 + pan) / 2 * 2 ** 0.5

    bar = 4 * BEAT
    bars = int(seconds / bar) + 1
    for b in range(bars):
        t0 = b * bar
        notes, root = CHORDS[b % 4]
        next_root = CHORDS[(b + 1) % 4][1]

        # Piano comping: beat 1, the "and" of 2, sometimes the "and" of 4
        hits = [0, 1 + SWING]
        if b % 2 == 1:
            hits.append(3 + SWING)
        for h in hits:
            for k, note in enumerate(notes):
                place(epiano(midi(note), 1.6, 0.11), t0 + h * BEAT + k * 0.008, pan=-0.25)

        # Walking bass: root, chord tone, chord tone, chromatic approach
        walk = [root, root + (7 if b % 2 else 4), root + 12 if b % 3 == 0 else root + 7, next_root + (1 if b % 2 else -1)]
        for i, m in enumerate(walk):
            place(bass(midi(m), BEAT * 0.95, 0.42), t0 + i * BEAT, pan=0.05)

        # Drums: ride pattern, brushes on 2 and 4, soft kick on 1 and 3
        for beat in range(4):
            place(ride(0.07), t0 + beat * BEAT, pan=0.35)
            if beat in (1, 3):
                place(ride(0.05), t0 + (beat + SWING) * BEAT, pan=0.35)
                place(brush(0.05), t0 + beat * BEAT, pan=-0.1)
            if beat in (0, 2):
                place(kick(0.18), t0 + beat * BEAT)

        # A few vibraphone notes every other bar
        if b % 2 == 0 and b > 0:
            for k in range(3):
                place(vibes(midi(SCALE[rng.integers(len(SCALE))]), 1.2, 0.09), t0 + (k * 1.0 + SWING * (k % 2)) * BEAT, pan=0.3)

    mix = np.stack([left, right], axis=1)[: int(seconds * SR)]
    # Gentle fade in/out and normalise
    fade_in, fade_out = int(0.8 * SR), int(2.5 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    mix /= np.max(np.abs(mix)) / 0.8
    return mix


if __name__ == "__main__":
    seconds = float(sys.argv[1])
    out = sys.argv[2]
    audio = (render(seconds) * 32767).astype(np.int16)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(audio.tobytes())
    print(f"wrote {out} ({seconds:.1f} s)")
