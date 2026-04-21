// router.js — ハッシュベースルーティング（DESIGN.md §1.4）。
//
// 管理するルート:
//   #/             … 相談画面
//   #/onboarding   … オンボーディング
//   #/history      … 履歴一覧
//   #/history/:id  … 履歴詳細

const ROUTES = {
  ROOT: "#/",
  ONBOARDING: "#/onboarding",
  HISTORY: "#/history",
};

const _listeners = new Set();
let _current = null;

function parseHash(hash) {
  const h = (hash || location.hash || "#/").replace(/^#!?/, "#");
  // Normalize trailing slashes (except root)
  const clean = h.replace(/\/+$/, "") || "#";
  if (clean === "#" || clean === "#/") {
    return { name: "root", path: "/", params: {} };
  }
  if (clean === "#/onboarding") {
    return { name: "onboarding", path: "/onboarding", params: {} };
  }
  if (clean === "#/history") {
    return { name: "history", path: "/history", params: {} };
  }
  const m = clean.match(/^#\/history\/(.+)$/);
  if (m) {
    return { name: "historyDetail", path: `/history/${m[1]}`, params: { sessionId: decodeURIComponent(m[1]) } };
  }
  // Unknown → root
  return { name: "root", path: "/", params: {}, fallback: true };
}

function emit(route) {
  _current = route;
  for (const cb of _listeners) {
    try {
      cb(route);
    } catch (_) {}
  }
}

function onHashChange() {
  const r = parseHash(location.hash);
  // Unknown ハッシュは root にフォールバック（§7.1）
  if (r.fallback) {
    navigate(ROUTES.ROOT);
    return;
  }
  emit(r);
}

window.addEventListener("hashchange", onHashChange);

export function navigate(hash) {
  if (!hash.startsWith("#")) hash = "#" + hash;
  if (location.hash === hash) {
    // ハッシュ変化がない場合は手動で emit
    onHashChange();
  } else {
    location.hash = hash;
  }
}

export function subscribe(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

export function current() {
  return _current || parseHash(location.hash);
}

/** 初回ロード時に現在のハッシュに対して emit する（subscribe 登録後に呼ぶ）。 */
export function start() {
  const r = parseHash(location.hash);
  if (r.fallback) {
    navigate(ROUTES.ROOT);
    return;
  }
  emit(r);
}

export { ROUTES };
