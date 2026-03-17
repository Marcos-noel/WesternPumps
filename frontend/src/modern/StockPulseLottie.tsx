import React from "react";
import Lottie from "lottie-react";

const pulseAnim = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 120,
  w: 120,
  h: 120,
  nm: "stock-pulse",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "ring",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 60, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [60, 60, 100] }, { t: 120, s: [130, 130, 100] }] }
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [70, 70] } },
            { ty: "st", c: { a: 0, k: [0.02, 0.71, 0.83, 1] }, o: { a: 1, k: [{ t: 0, s: [70] }, { t: 120, s: [0] }] }, w: { a: 0, k: 6 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
          ]
        }
      ],
      ip: 0,
      op: 120,
      st: 0,
      bm: 0
    }
  ]
};

export default function StockPulseLottie() {
  return <Lottie animationData={pulseAnim as any} loop className="h-20 w-20 opacity-90" />;
}

