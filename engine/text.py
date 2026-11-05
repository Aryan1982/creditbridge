"""Small formatting and date helpers shared across the engine (stdlib only)."""

from __future__ import annotations

from datetime import date


def inr(x: float) -> str:
    """Indian digit grouping, rounded to whole rupees: -123456.5 → '-₹1,23,456'."""
    neg, x = x < 0, abs(round(x))
    s = str(int(x))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = ",".join([head[max(0, i - 2):i] for i in range(len(head), 0, -2)][::-1])
        s = head + "," + tail
    return ("-₹" if neg else "₹") + s


def to_date(s) -> date:
    """`date` from a date or an ISO 'YYYY-MM-DD…' string."""
    return s if isinstance(s, date) else date.fromisoformat(str(s)[:10])


def months_between(a, b) -> list[str]:
    """Calendar months 'YYYY-MM' from a's month to b's month inclusive (dates or ISO strings)."""
    a, b = to_date(a), to_date(b)
    out, y, m = [], a.year, a.month
    while (y, m) <= (b.year, b.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out
