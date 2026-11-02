import {test} from 'node:test';
import assert from 'node:assert/strict';
import {oauthRedirectUrl} from '../src/redirect.js';

const loopback='http://127.0.0.1:45255/callback';
const localResult={redirectUrl:loopback+'?code=temporary-code&state=nonce'};
test('RFC 8252 loopback HTTP callback is accepted only for its reviewed client',()=>{
 assert.equal(oauthRedirectUrl(localResult,loopback),localResult.redirectUrl);
 assert.equal(oauthRedirectUrl({redirectUrl:'http://localhost:4000/cb?code=x'},'http://localhost:4000/cb'),'http://localhost:4000/cb?code=x');
 assert.equal(oauthRedirectUrl({redirectUrl:'http://[::1]:4000/cb?code=x'},'http://[::1]:4000/cb'),'http://[::1]:4000/cb?code=x');
});
test('normal HTTPS OAuth callbacks remain supported',()=>{
 assert.equal(oauthRedirectUrl({redirectUrl:'https://client.example/oauth/cb?code=x'},'https://client.example/oauth/cb'),'https://client.example/oauth/cb?code=x');
});
test('reject remote HTTP, changed callback paths, hosts, ports and credentials',()=>{
 const rejected=[
 ['http://attacker.example/callback?code=x','http://attacker.example/callback'],
 ['http://127.0.0.1:9999/callback?code=x',loopback],
 ['http://127.0.0.1:45255/different?code=x',loopback],
 ['https://evil.example/cb?code=x','https://client.example/cb'],
 ['http://user:pass@127.0.0.1:45255/callback?code=x',loopback],
 ['http://127.0.0.2:45255/callback?code=x','http://127.0.0.2:45255/callback'],
 ];
 for(const [actual,expected] of rejected)assert.throws(()=>oauthRedirectUrl({redirectUrl:actual},expected));
});
test('preserve required existing redirect query parameters',()=>{
 const expected='https://client.example/callback?fixed=one';
 const valid=expected+'&code=x&state=y';
 assert.equal(oauthRedirectUrl({redirectUrl:valid},expected),valid);
 assert.throws(()=>oauthRedirectUrl({redirectUrl:'https://client.example/callback?code=x'},expected));
 assert.throws(()=>oauthRedirectUrl({},expected));
 assert.throws(()=>oauthRedirectUrl({redirectUrl:valid},''));
});
