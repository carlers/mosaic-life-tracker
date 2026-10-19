# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 isolated Supabase create-and-master HTTP proof; no backend switch.

## Boundary
- Base accepted isolated stable `refactor/967-atomic-pull-checkpoint-20261019@f87219b6ea61ebacaad58c5eb92261ac8eb4dcb2`. Focused #39184309345 SUCCESS, canonical #39184409560 SUCCESS; trusted #39184559649 prebuilt READY for exact source.
- Task `chatgpt/967-create-master-transport-20261019`; no source imported into shipped runtime, Supabase schema or real accounts/records changes, Appwrite/deployment config/promotions/version changes.
- Isolated `mosaic-dev` candidate remains a Free test project; last observed 0 Auth users and 0 candidate tasks/categories. Two callable SECURITY DEFINER CAS warning findings unresolved.

## Work
- Implement opt-in `candidateCreateTransport.ts`: create task/category with verified owner session, strict Mosaic row ID, POST only with server returned revision, no client sequence, no upsert.
- On 409 only, authenticated owner-scoped master GET and explicit conflict. Missing owner master or malicious/faulty reply fails closed. No automatic retry for ambiguous network writes; 401/403 and 5xx are distinct.
- Unit mock HTTP coverage and evaluation notes. Existing RxDB replicateRxCollection native checkpoint should be preferred over adding a second storage system; earlier atomic-store POC is a contract only.

## Verification
- Task focused and isolated stable Preview canonical/trusted verification PENDING. No real signed HTTP/JWT nor live concurrency tests.

## Next action
- Commit final work with [verify:focused], review focused failures, then squash into a new stable isolated Preview; require canonical and trusted delivery. Keep #967 open and no dev/main/Production/app/provider switch.
- Genuine HTTP acceptance requires two confirmed disposable Supabase Auth users; operator only, never paste passwords. After that, test real insertion/duplicate ownership, cross-connection CAS and RxDB integrated pull/push with owned pending local changes.
