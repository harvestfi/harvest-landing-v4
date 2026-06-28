// IndexNow key — shared by build-seo-static.mjs (which publishes the key
// verification file) and indexnow-submit.mjs (which signs submissions).
//
// This value is PUBLIC by design: the IndexNow protocol authenticates a
// submission by checking that the same key is hosted at
// https://<host>/<key>.txt. Ownership is proved by being able to serve
// that file, not by keeping the key secret — so it lives in the repo, not
// in a GitHub secret. Generated once with `crypto.randomBytes(16)`.
//
// Allowed charset per spec: a-z A-Z 0-9 and '-', length 8..128.
export const INDEXNOW_KEY = "5511c06a34e3f1f2482eed736cf0a6ae";
