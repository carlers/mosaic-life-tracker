/**
 * The demo has no remote server to check. "checking" prevents production
 * sync/push/async delivery effects without the real app's offline overlay.
 */
const DEMO_CONNECTIVITY={status:'checking',reason:'local-demo',lastConfirmedAt:null} as const;
export function useConnectivity(){return DEMO_CONNECTIVITY;}
