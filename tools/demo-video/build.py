"""Assembles the demo video from the recorded frames, captions and music.

    node tools/demo-video/record.mjs      # 1. record frames (out/frames, out/frames.json)
    python3 tools/demo-video/build.py     # 2. build out/cat-aims-at-you-demo.mp4

Captions are bilingual (English above, Chinese below) and timed to the scene
marks written by the recorder.
"""
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
FPS = 30
EN_FONT = "Helvetica Neue"
ZH_FONT = "Hiragino Sans GB"

# (scene mark, English, Chinese). Title and outro are full-screen cards.
TITLE = ("Cat Aims At You", "猫猫瞄准你", "A 3D cat that never takes its eyes off you", "一只永远盯着你的 3D 猫")
SCENES = [
    ("aim", "It tracks your face through the front camera", "通过前置摄像头追踪你的脸"),
    ("window", "Move your head: the screen becomes a 3D window", "移动头部，屏幕就变成一扇 3D 窗口"),
    ("blink", "Blink to fire", "眨眼即开火"),
    ("expr", "It copies you: wink, yawn, smile, tilt your head", "它会模仿你：眨眼、打哈欠、微笑、歪头"),
    ("poke", "Poke its nose, belly, gun or feet", "戳戳它的鼻子、肚子、枪或脚"),
    ("level", "The floor stays level with your desk, or the horizon", "地面始终与桌面或地平线保持水平"),
    ("third", "Third-person view: see exactly where it aims", "第三人称视角：看清它瞄准的位置"),
]
OUTRO = ("Runs entirely in your browser", "完全在浏览器中运行", "Your video never leaves your device", "视频不会离开你的设备",
         "alexgoexercise.github.io/cat-aims-at-you")


def ts(sec):
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int(sec % 3600 // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def ass(captions, title_end, outro_start, end):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{EN_FONT},34,&H00FFFFFF,&H00FFFFFF,&H64140A1E,&H64140A1E,1,0,0,0,100,100,0,0,3,14,0,2,60,60,34,1
Style: Big,{EN_FONT},76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,3,5,60,60,0,1
Style: Sub,{EN_FONT},34,&H00F2E6FF,&H00F2E6FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,2,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    zh = lambda size: rf"{{\fn{ZH_FONT}\fs{size}}}"
    lines = []
    t_en, t_zh, s_en, s_zh = TITLE
    lines.append(f"Dialogue: 0,{ts(0.2)},{ts(title_end)},Big,,0,0,0,,{{\\fad(400,400)\\pos(640,300)}}{t_en}\\N{zh(56)}{t_zh}")
    lines.append(f"Dialogue: 0,{ts(0.6)},{ts(title_end)},Sub,,0,0,0,,{{\\fad(400,400)\\pos(640,470)}}{s_en}\\N{zh(30)}{s_zh}")
    for start, stop, en, cn in captions:
        lines.append(f"Dialogue: 0,{ts(start + 0.15)},{ts(stop - 0.1)},Cap,,0,0,0,,{{\\fad(250,250)}}{en}\\N{zh(30)}{cn}")
    o1, o1z, o2, o2z, url = OUTRO
    lines.append(f"Dialogue: 0,{ts(outro_start + 0.2)},{ts(end)},Big,,0,0,0,,{{\\fad(400,600)\\pos(640,250)\\fs58}}{o1}\\N{zh(44)}{o1z}")
    lines.append(f"Dialogue: 0,{ts(outro_start + 0.6)},{ts(end)},Sub,,0,0,0,,{{\\fad(400,600)\\pos(640,420)}}{o2}\\N{zh(30)}{o2z}")
    lines.append(f"Dialogue: 0,{ts(outro_start + 1.0)},{ts(end)},Sub,,0,0,0,,{{\\fad(400,600)\\pos(640,560)\\c&H00D84FFF&\\b1}}{url}")
    return head + "\n".join(lines) + "\n"


def main():
    data = json.loads((OUT / "frames.json").read_text())
    frames, marks = data["frames"], data["marks"]
    t0, t_end = marks["title"], marks["end"]
    rel = {k: (v - t0) / 1000 for k, v in marks.items()}
    duration = rel["end"]

    # 1. Frames -> constant-frame-rate footage (each frame shown until the next one)
    clip = [f for f in frames if t0 - 50 <= f["t"] <= t_end + 50]
    with open(OUT / "frames.txt", "w") as fh:
        for a, b in zip(clip, clip[1:] + [None]):
            fh.write(f"file 'frames/{a['file']}'\n")
            fh.write(f"duration {((b['t'] if b else a['t'] + 1000 / FPS) - a['t']) / 1000:.4f}\n")
        fh.write(f"file 'frames/{clip[-1]['file']}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(OUT / "frames.txt"),
                    "-fps_mode", "cfr", "-r", str(FPS), "-t", f"{duration:.3f}", "-c:v", "libx264", "-crf", "16",
                    "-pix_fmt", "yuv420p", str(OUT / "footage.mp4")], check=True)

    # 2. Music
    subprocess.run(["python3", str(HERE / "music.py"), f"{duration:.2f}", str(OUT / "music.wav")], check=True)

    # 3. Captions
    order = [s[0] for s in SCENES] + ["outro"]
    caps = [(rel[name], rel[order[i + 1]], en, cn) for i, (name, en, cn) in enumerate(SCENES)]
    (OUT / "captions.ass").write_text(ass(caps, rel["aim"], rel["outro"], duration), encoding="utf-8")

    # 4. Assemble: dim the title/outro cards, burn in captions, add music
    title_end, outro = rel["aim"], rel["outro"]
    dim = f"drawbox=x=0:y=0:w=iw:h=ih:color=0x0b0716@0.8:t=fill:enable='lt(t,{title_end:.2f})+gte(t,{outro:.2f})'"
    final = OUT / "cat-aims-at-you-demo.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(OUT / "footage.mp4"), "-i", str(OUT / "music.wav"),
        "-filter_complex", f"[0:v]{dim},ass={OUT / 'captions.ass'}:fontsdir=/System/Library/Fonts[v];[1:a]volume=-2dB[a]",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", str(final),
    ], check=True)
    print(f"built {final} ({duration:.1f} s)")


if __name__ == "__main__":
    main()
