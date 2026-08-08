/** Shared in-memory employee list cache (used by employee list API). */

const LIST_CACHE_TTL_MS = 300000; // 5 minutes max staleness (invalidated on writes)

let _listCache = { data: null, ts: 0 };

function getListCache() {
  if (_listCache.data && Date.now() - _listCache.ts < LIST_CACHE_TTL_MS) {
    return _listCache.data;
  }
  return null;
}

function setListCache(data) {
  _listCache = { data, ts: Date.now() };
}

function invalidateListCache() {
  _listCache = { data: null, ts: 0 };
}

module.exports = {
  LIST_CACHE_TTL_MS,
  getListCache,
  setListCache,
  invalidateListCache,
};
