/** Shared in-memory employee list cache (used by employee list API). */

const LIST_CACHE_TTL_MS = 300000; // 5 minutes max staleness (invalidated on writes)
const APPROVED_LEAVES_TTL_MS = 30000;

let _listCache = { data: null, ts: 0 };
let _approvedLeavesCache = { data: null, ts: 0 };

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

/** Patch one employee in-place so leave vacation updates don't force a cold Mongo reload. */
function patchListCacheEmployee(employeeId, patch) {
  if (!_listCache.data || !employeeId || !patch) return false;
  const id = String(employeeId);
  let found = false;
  _listCache.data = _listCache.data.map((e) => {
    if (String(e._id) !== id && String(e.employeeId || '') !== id) return e;
    found = true;
    return { ...e, ...patch };
  });
  return found;
}

function getApprovedLeavesCache() {
  if (_approvedLeavesCache.data && Date.now() - _approvedLeavesCache.ts < APPROVED_LEAVES_TTL_MS) {
    return _approvedLeavesCache.data;
  }
  return null;
}

function setApprovedLeavesCache(data) {
  _approvedLeavesCache = { data, ts: Date.now() };
}

function invalidateApprovedLeavesCache() {
  _approvedLeavesCache = { data: null, ts: 0 };
}

module.exports = {
  LIST_CACHE_TTL_MS,
  APPROVED_LEAVES_TTL_MS,
  getListCache,
  setListCache,
  invalidateListCache,
  patchListCacheEmployee,
  getApprovedLeavesCache,
  setApprovedLeavesCache,
  invalidateApprovedLeavesCache,
};
