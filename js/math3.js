// Tiny vector and quaternion helpers so the simulation can place parts without the 3D library (it runs headless in Node).
// Vectors are [x, y, z]; quaternions are [x, y, z, w].
export const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

export const q = {
  id: () => [0, 0, 0, 1],
  axisAngle(ax, ang) { const s = Math.sin(ang / 2), n = v.norm(ax); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(ang / 2)]; },
  // The rotation that turns unit vector a into unit vector b.
  fromTo(a, b) {
    const d = v.dot(a, b);
    if (d < -0.999999) {
      let ax = v.cross([1, 0, 0], a);
      if (v.len(ax) < 1e-6) ax = v.cross([0, 1, 0], a);
      return q.axisAngle(ax, Math.PI);
    }
    const c = v.cross(a, b), w = 1 + d, l = Math.hypot(c[0], c[1], c[2], w);
    return [c[0] / l, c[1] / l, c[2] / l, w / l];
  },
  mul(a, b) {   // a*b: applies b first, then a
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  },
  rot(qq, p) {   // rotate vector p by quaternion qq
    const [x, y, z, w] = qq, [px, py, pz] = p;
    const ix = w * px + y * pz - z * py, iy = w * py + z * px - x * pz, iz = w * pz + x * py - y * px, iw = -x * px - y * py - z * pz;
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  },
};
