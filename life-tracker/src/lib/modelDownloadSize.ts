/** Browser-reported byte counts; never infer total model sizes from percentages. */
export function formatModelBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
export function modelDownloadNotice(label: string, loaded?: number, total?: number,
  percent?: number): string {
  if (typeof loaded === 'number' && typeof total === 'number' &&
      Number.isFinite(loaded) && Number.isFinite(total) && total > 0 &&
      loaded >= 0 && loaded <= total) {
    return `${label}: ${formatModelBytes(loaded)} / ${formatModelBytes(total)}`;
  }
  return label + (typeof percent === 'number' && Number.isFinite(percent)
    ? ` (${Math.round(percent)}%)` : '');
}
