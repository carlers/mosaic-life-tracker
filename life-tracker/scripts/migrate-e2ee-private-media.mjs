/**
 * Explicitly opt-in exact Oracle Scratch client-ciphertext media bucket (#2084).
 * This is additive and must not change the existing plaintext task_images bucket.
 * Bucket-level browser create/read/update/delete grants are forbidden.
 */
const SCRATCH = '6b00671500279e901846';
const LIMIT = 12 * 1024 * 1024;
const CHUNK = 65536;
export const OWNER_PRIVATE_MEDIA_BUCKET = Object.freeze({
  id: 'private_owner_media_v1',
  name: 'Private Owner E2EE Media (Staged)',
  permissions: [],
  fileSecurity: true,
  enabled: true,
  maximumFileSize: LIMIT + 16 * Math.ceil(LIMIT / CHUNK),
  allowedFileExtensions: ['bin'],
  compression: 'none',
  encryption: true,
  // Virus scanner cannot inspect AEAD ciphertext; do not claim malware scanned.
  antivirus: false,
  // Appwrite image transformations must never transform encrypted bytes.
  transformations: false,
});
function blocked(message) { throw new Error('E2EE private media staging blocked: ' + message); }
function setEq(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return [...actual].sort().every((value,i) => value === [...expected].sort()[i]);
}
export function assertEncryptedMediaBucket(actual) {
  const expected = OWNER_PRIVATE_MEDIA_BUCKET;
  if (!actual || actual.$id !== expected.id) blocked('wrong bucket identity');
  for(const key of [
    'name','fileSecurity','enabled','maximumFileSize','compression',
    'encryption','antivirus','transformations',
  ]) if(actual[key] !== expected[key]) blocked('bucket contract drift: ' + key);
  const permissions=actual.$permissions ?? actual.permissions;
  if (!setEq(permissions,expected.permissions)) blocked('browser access grants present');
  if (!setEq(actual.allowedFileExtensions,expected.allowedFileExtensions))
    blocked('extension policy drift');
  return true;
}

export async function migratePrivateOwnerMediaBucket({
  request, projectId, log=()=>{},
}) {
  if(projectId !== SCRATCH) blocked('not exact Oracle Scratch project');
  if(typeof request !== 'function') blocked('missing managed request');
  const path='/storage/buckets/'+OWNER_PRIVATE_MEDIA_BUCKET.id;
  let actual=null;
  try{actual=await request('GET',path);}
  catch(error){if(Number(error?.status)!==404)throw error;}
  if(actual) {
    assertEncryptedMediaBucket(actual);
    return {bucketId:OWNER_PRIVATE_MEDIA_BUCKET.id,created:false};
  }
  const e=OWNER_PRIVATE_MEDIA_BUCKET;
  // This exact schema requires a credentialed Appwrite Scratch administrator;
  // the existing broker's create_bucket subset cannot set these constraints.
  await request('POST','/storage/buckets',{
    bucketId:e.id,name:e.name,permissions:[],fileSecurity:true,enabled:true,
    maximumFileSize:e.maximumFileSize,allowedFileExtensions:[...e.allowedFileExtensions],
    compression:e.compression,encryption:e.encryption,
    antivirus:e.antivirus,transformations:e.transformations,
  });
  // No optimistic success without authoritative full-ACL readback.
  let created=null;
  try{created=await request('GET',path);}
  catch(error){blocked('post-create readback unavailable');}
  assertEncryptedMediaBucket(created);
  log('Scratch-only owner ciphertext media bucket created and verified');
  return {bucketId:e.id,created:true};
}
