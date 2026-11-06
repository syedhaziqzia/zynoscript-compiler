"""Tiny in-memory sliding-window rate limiter (per process; good enough to blunt brute force and API spam)."""
import threading
import time
from collections import defaultdict, deque

_lock = threading.Lock()
_hits: dict[str, deque] = defaultdict(deque)


def _prune(q: deque, window: float, now: float):
    while q and now - q[0] > window:
        q.popleft()


def hit(key: str, limit: int, window: float) -> bool:
    """Records one event for `key`. Returns False when the key has exceeded `limit` events within `window` seconds."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        _prune(q, window, now)
        if len(q) >= limit:
            return False
        q.append(now)
        return True


def blocked(key: str, limit: int, window: float) -> bool:
    """True if `key` already has `limit` events in the window (does not record a new one)."""
    now = time.monotonic()
    with _lock:
        q = _hits.get(key)
        if not q:
            return False
        _prune(q, window, now)
        return len(q) >= limit


def reset(key: str | None = None):
    with _lock:
        if key is None:
            _hits.clear()
        else:
            _hits.pop(key, None)
