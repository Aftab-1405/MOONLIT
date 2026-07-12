"""Shared HTTP rate limiter instance for slowapi decorators.

ENH [RL-HTTP]: Previously the limiter was created in main.py and registered
on app.state, but NO routes had @limiter.limit decorators — the limiter
existed but never enforced. This module provides a shared instance that
controllers can import and apply via decorators.

ENH [RL-HTTP-FIX]: slowapi uses the SYNCHRONOUS redis library (not
redis.asyncio). Upstash Redis requires TLS and has connection quirks
that the sync client doesn't handle well — it raises
`ConnectionError: Connection closed by server`. In dev mode (DEBUG=True),
we force memory storage to avoid this. In production, set
RATELIMIT_STORAGE_URL to a Redis URL that the sync client can handle
(standard Redis, not Upstash TLS-only), or use a separate Redis instance.

FIX [AUDIT-2-D]: the previous ``key_func=get_remote_address`` is not
proxy-aware — behind nginx / ALB / Cloudflare it returns the proxy's IP
for every request, so all users share a single rate-limit bucket. The
new ``_proxy_aware_remote_address`` honors ``X-Forwarded-For`` (leftmost
non-trusted hop) and ``X-Real-IP`` when the request appears to come from
a trusted proxy (loopback or private CIDR).

Usage in controllers::

    from controller.rate_limiter import limiter

    @router.post("/endpoint")
    @limiter.limit("50 per minute")
    async def my_endpoint(request: Request, ...):
        ...

Note: slowapi requires the ``request: Request`` parameter to be present in
the route function signature for the decorator to work.
"""

import ipaddress
import logging

from slowapi import Limiter
from starlette.requests import Request

from config import get_config

logger = logging.getLogger(__name__)
Config = get_config()


#: RFC 1918 private networks + loopback. We intentionally do NOT treat
#: all ``ipaddress.is_private`` addresses as trusted, because Python's
#: ``is_private`` also includes TEST-NET (203.0.113.0/24), benchmarking
#: (198.18.0.0/15), and other special-use ranges that should not be
#: trusted as proxies in production.
_TRUSTED_PRIVATE_NETWORKS: tuple[str, ...] = (
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
    "169.254.0.0/16",  # IPv4 link-local
    "::1/128",
    "fc00::/7",  # IPv6 unique-local
    "fe80::/10",  # IPv6 link-local
)


def _is_trusted_proxy(ip_str: str) -> bool:
    """Return True if ``ip_str`` is a trusted proxy (loopback or RFC 1918 private).

    Args:
        ip_str: IPv4/IPv6 address string.

    Returns:
        True if the address is loopback, in an RFC 1918 private range,
        IPv6 unique-local, or IPv6 link-local. TEST-NET and other
        special-use ranges are NOT trusted.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    for cidr in _TRUSTED_PRIVATE_NETWORKS:
        try:
            if ip in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            continue
    return False


def _proxy_aware_remote_address(request: Request) -> str:
    """Return the client IP, honoring ``X-Forwarded-For`` behind a proxy.

    Falls back to ``request.client.host`` when no proxy headers are
    present or when the immediate peer is not a trusted proxy.

    Args:
        request: Inbound Starlette / FastAPI request.

    Returns:
        The client IP string to use as the rate-limit key.
    """
    peer = request.client.host if request.client else ""
    if not peer:
        return ""

    # Only trust forwarded headers when the immediate peer is itself a
    # trusted proxy (loopback / private / link-local). This prevents a
    # remote attacker from spoofing X-Forwarded-For to dodge rate limits.
    if not _is_trusted_proxy(peer):
        return peer

    # X-Forwarded-For: client, proxy1, proxy2, ... — leftmost is the
    # original client. Take the leftmost non-empty, non-trusted hop.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        for hop in (h.strip() for h in xff.split(",")):
            if hop and not _is_trusted_proxy(hop):
                return hop
        # All hops were trusted proxies; fall through to X-Real-IP.
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        return x_real_ip.strip()
    return peer


storage_uri = Config.RATELIMIT_STORAGE_URL
limiter = Limiter(
    key_func=_proxy_aware_remote_address,
    storage_uri=storage_uri,
    enabled=Config.RATELIMIT_ENABLED,
)
