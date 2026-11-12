# Cat Aims At You 🐱🔫

A static website: a 3D meme cat stands in the middle of the screen holding a (cartoon) pistol.
It uses your front camera to track your face in 3D and always keeps the barrel pointed at you.

- No build step and no backend. Plain HTML + ES modules, with libraries loaded from a CDN.
- The video stays on your device. Face tracking runs locally in the browser (WebAssembly/WebGL).
- Works on laptops and phones (front camera). Mouse/touch fallback if you deny camera access.

## Run locally

Camera access needs a secure context, and `http://localhost` counts as one:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173 and click **Enable camera**.

To test on a phone, the page has to be served over HTTPS (deploy it, or use a tunnel such as `cloudflared` or `ngrok`).

## Deploy (GitHub Pages)

1. Push this folder to a GitHub repo.
2. In the repo, open **Settings → Pages**, set **Source: Deploy from a branch** and pick `main` / root.
3. The site goes live at `https://<user>.github.io/<repo>/` over HTTPS, so the camera works on phones too.

## How it works

| Step | File | What happens |
| --- | --- | --- |
| Face landmarks | `src/tracker.js` | MediaPipe Face Landmarker finds 478 face points per video frame, including both iris centres. |
| 3D position | `src/tracker.js` | Pinhole camera model. Distance comes from how far apart your irises appear: `z = focal_px × 6.3 cm / iris_distance_px`. The focal length is derived from the camera's field of view. X and Y are then back-projected from the point between your eyes. |
| Smoothing | `src/filter.js` | A one-euro filter removes jitter without adding lag when you move quickly. |
| Window effect | `src/main.js` | Head-coupled (off-axis) perspective: the virtual camera sits where your eyes are and the view frustum goes through the physical screen edges, so the screen behaves like a window into a small room. |
| Aiming | `src/cat.js` | The head and gun `lookAt()` your eye position in world space (meters, origin at the screen centre). The arms stretch to stay on the grip. |

The cat is built from Three.js primitives (`src/cat.js`), so there are no model files. To use a real
model, load a GLB with `GLTFLoader` and point its gun bone at the same target.

## Tuning

All values live in `src/config.js`, and some can be overridden with URL parameters:

| Param | Default | Meaning |
| --- | --- | --- |
| `fov` | 72 (desktop) / 78 (phone) | Diagonal FOV of the webcam in degrees. If the distance readout is off, adjust this. |
| `mpp` | 0.00021 / 0.00018 | Meters per CSS pixel, used to estimate the physical screen size. |
| `dist` | 0.55 / 0.35 | Assumed viewing distance in meters when no face is tracked. |
| `parallax` | 1 | Set to `0` to turn off the head-coupled window effect. |

Example: `http://localhost:5173/?fov=78&parallax=0`

## Ideas / next steps

- Replace the procedural cat with a rigged GLB model.
- Calibration screen ("hold a credit card up to the camera") for accurate distance and FOV.
- Laser sight dot, sound toggle, a screenshot/share button.
- Account for phone orientation (front camera on the side in landscape).
