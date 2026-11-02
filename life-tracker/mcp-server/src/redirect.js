// Validate Appwrite's authorization callback against the user's reviewed redirect.
// RFC 8252 permits HTTP only on loopback hosts for public native/CLI clients.
export function oauthRedirectUrl(result, expectedRedirect) {
 if (!result?.redirectUrl || !expectedRedirect) throw Error('OAuth redirect unavailable');
 const expected=new URL(expectedRedirect);
 const actual=new URL(result.redirectUrl);
 const isLoopback=['localhost','127.0.0.1','[::1]'].includes(expected.hostname);
 if (!(expected.protocol==='https:' || expected.protocol==='http:'&&isLoopback) ||
     actual.protocol!==expected.protocol || actual.host!==expected.host ||
     actual.pathname!==expected.pathname || actual.username || actual.password)
   throw Error('OAuth redirect does not match the authorized client');
 for (const [key,value] of expected.searchParams)
   if(!actual.searchParams.getAll(key).includes(value))
     throw Error('OAuth redirect changed the authorized callback');
 return actual.href;
}
