/** Local, MIT-licensed QR encoder API used for transient TOTP enrollment. */
export interface QrSymbol {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, column: number): boolean;
}
export function qrcode(
  typeNumber: number,
  errorCorrectionLevel: "L" | "M" | "Q" | "H",
): QrSymbol;
export default qrcode;
