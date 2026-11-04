import { useEffect, useState } from "react";

/** In-browser QR generation: the otpauth URI never becomes a network URL. */
export function MfaQrCode({ uri }: { uri: string }) {
  const [drawing, setDrawing] = useState<{ size: number; path: string } | null>(null);

  useEffect(() => {
    let current = true;
    setDrawing(null);
    void import("../../lib/vendor/qrcodegen").then(({ qrcodegen }) => {
      const qr = qrcodegen.QrCode.encodeText(uri, qrcodegen.QrCode.Ecc.MEDIUM);
      const path: string[] = [];
      for (let y = 0; y < qr.size; y += 1) {
        for (let x = 0; x < qr.size; x += 1) {
          if (qr.getModule(x, y)) path.push(`M${x},${y}h1v1h-1z`);
        }
      }
      if (current) setDrawing({ size: qr.size, path: path.join(" ") });
    }).catch(() => {
      if (current) setDrawing(null);
    });
    return () => { current = false; };
  }, [uri]);

  if (!drawing) return <p role="status" className="text-sm text-gray-400">
    QR code unavailable. Use the manual setup key below.
  </p>;

  return (
    <svg role="img" aria-label="Authenticator setup QR code" className="w-48 h-48 max-w-full mx-auto"
      viewBox={`-4 -4 ${drawing.size + 8} ${drawing.size + 8}`}
      shapeRendering="crispEdges">
      <rect x={-4} y={-4} width={drawing.size + 8} height={drawing.size + 8} fill="#fff" />
      <path d={drawing.path} fill="#000" />
    </svg>
  );
}
