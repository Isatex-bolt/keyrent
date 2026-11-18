import numpy as np, cv2, json
from PIL import Image
im = np.array(Image.open('/tmp/logo/color.png').convert('RGB')).astype(np.float32)
H, W, _ = im.shape
NAVY = np.array([0x01, 0x19, 0x38], np.float32); TEAL = np.array([0x02, 0xa8, 0xa9], np.float32); WHITE = np.array([255,255,255], np.float32)
S = 4
import sys
SIG = float(sys.argv[1]) if len(sys.argv) > 1 else 10
STEP = float(sys.argv[2]) if len(sys.argv) > 2 else 9
big = cv2.resize(im, (W*S, H*S), interpolation=cv2.INTER_CUBIC)
lab = np.stack([np.linalg.norm(big - c, axis=2) for c in (WHITE, NAVY, TEAL)]).argmin(0)

def smooth_closed(pts, sigma):
    n = len(pts)
    k = int(sigma * 3)
    w = np.exp(-0.5 * (np.arange(-k, k+1) / sigma) ** 2); w /= w.sum()
    ext = np.concatenate([pts[-k:], pts, pts[:k]])
    return np.stack([np.convolve(ext[:, i], w, mode='valid') for i in (0, 1)], 1)[:n]

def resample(pts, step):
    p = np.vstack([pts, pts[:1]])
    seg = np.hypot(*np.diff(p, axis=0).T); cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1]; t = np.arange(0, L, step)
    return np.stack([np.interp(t, cum, p[:, 0]), np.interp(t, cum, p[:, 1])], 1)

def to_path(pts):
    # Catmull-Rom chiusa → Bézier cubiche (continuità di tangente garantita)
    n = len(pts); d = [f"M{pts[0][0]:.0f} {pts[0][1]:.0f}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[i-1], pts[i], pts[(i+1) % n], pts[(i+2) % n]
        c1 = p1 + (p2 - p0) / 6; c2 = p2 - (p3 - p1) / 6
        d.append(f"C{c1[0]:.0f} {c1[1]:.0f} {c2[0]:.0f} {c2[1]:.0f} {p2[0]:.0f} {p2[1]:.0f}")
    return "".join(d) + "Z"

out = {}
for idx, name in ((1, 'navy'), (2, 'teal')):
    m = (lab == idx).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    m = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), 6) > 127).astype(np.uint8)
    cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    paths = []
    for c in cnts:
        if cv2.contourArea(c) < 400 * S * S / 4: continue
        pts = c[:, 0, :].astype(np.float64)
        pts = smooth_closed(pts, sigma=SIG * S)           # leviga il rumore dei pixel
        pts = resample(pts, step=STEP * S) / S             # un punto ogni ~6 px dell'originale
        paths.append(to_path(pts))
    out[name] = paths
    print(name, len(paths), 'contorni')
json.dump({'w': W, 'h': H, **out}, open('paths.json', 'w'))
