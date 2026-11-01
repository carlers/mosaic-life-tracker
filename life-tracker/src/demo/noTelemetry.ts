/** Demo runtime cannot initialize analytics or remotely evaluate feature flags. */
const state={enabled:false,isLoaded:true,hasError:false} as const;
export function getPostHogFeatureFlagState(_key:string){void _key;return state;}
export function subscribePostHogFeatureFlags(_listener:()=>void){void _listener;return ()=>{};}
export async function initializePostHog(){return;}
export function syncPostHogIdentity(_id:string|null){void _id;}
export function captureHandledException(_error:unknown,_context?:unknown){void _error;void _context;}
export function disposePostHog(){}
