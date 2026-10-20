"""Validated AI analysis and self-financing accounting for the Library runner.

No broker integration: all executions and charged costs are simulated.
Rates and returns are fractions, not percentage points.
"""
import json
import math
import os
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

COMMISSION_RATE = 0.0025
SLIPPAGE_RATE = 0.0015


class ProviderFailure(Exception):
    def __init__(self, reason, retryable=True):
        super().__init__(reason)
        self.retryable = retryable


def clean_text(value):
    if not isinstance(value, str):
        raise ProviderFailure("invalid_response")
    text = "".join(c for c in value if c in "\n\r\t" or
                   unicodedata.category(c) not in ("Cc", "Cf")).strip()
    if not text:
        raise ProviderFailure("empty_response")
    return text


def request_provider(provider, key, prompt, attempt, timeout):
    if provider == "gemini":
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
        headers = {"Content-Type": "application/json", "x-goog-api-key": key}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 16384 if attempt == 1 else 32768},
        }
    else:
        url = "https://api.deepseek.com/v1/chat/completions"
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
        payload = {"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}],
                   "max_tokens": 8192, "stream": False}
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(1_000_001)
        if len(body) > 1_000_000:
            raise ProviderFailure("response_too_large")
        return json.loads(body)
    except urllib.error.HTTPError as error:
        # Never expose upstream bodies, headers, URLs containing credentials, or keys.
        raise ProviderFailure(f"http_{error.code}", error.code == 429 or error.code >= 500) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise ProviderFailure("connection_or_timeout") from None
    except (ValueError, UnicodeError):
        raise ProviderFailure("invalid_json") from None


def validate_analysis(provider, body):
    try:
        if provider == "gemini":
            candidate = body["candidates"][0]
            if candidate.get("finishReason") != "STOP":
                raise ProviderFailure("incomplete_response")
            text = "".join(part.get("text", "") for part in candidate["content"]["parts"]
                           if not part.get("thought"))
        else:
            choice = body["choices"][0]
            if choice.get("finish_reason") != "stop":
                raise ProviderFailure("incomplete_response")
            text = choice["message"]["content"]
        return clean_text(text)
    except (KeyError, IndexError, TypeError, AttributeError):
        raise ProviderFailure("invalid_response") from None


def analyze_with_fallback(prompt, gemini_key=None, deepseek_key=None,
                          transport=request_provider, sleeper=time.sleep, timeout=8,
                          budget_seconds=30):
    """At most two attempts per provider; no storage until a complete answer exists."""
    prompt = clean_text(prompt)
    if len(prompt) > 60_000:
        raise ValueError("Analysis prompt exceeds 60000 characters; refusing silent truncation")
    if not all(math.isfinite(v) and v > 0 for v in (timeout, budget_seconds)):
        raise ValueError("Timeout and analysis budget must be positive and finite")
    deadline = time.monotonic() + budget_seconds
    errors, attempts = [], {"gemini": 0, "deepseek": 0}
    for provider, key in (("gemini", gemini_key), ("deepseek", deepseek_key)):
        if not key:
            errors.append(f"{provider}:not_configured")
            continue
        for attempt in (1, 2):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ProviderFailure("analysis_budget_exhausted", False)
            attempts[provider] = attempt
            try:
                body = transport(provider, key, prompt, attempt, min(timeout, remaining))
                if time.monotonic() > deadline:
                    raise ProviderFailure("analysis_budget_exhausted", False)
                text = validate_analysis(provider, body)
                return {"provider": provider, "text": text, "complete": True,
                        "attempts": attempts, "fallback_reasons": errors}
            except ProviderFailure as error:
                errors.append(f"{provider}:{error}")
                if not error.retryable:
                    break
                if attempt == 1:
                    sleeper(0.75)
    raise ProviderFailure("no_valid_analysis (" + ", ".join(errors) + ")", False)


def save_analysis(path, result):
    """Validate before touching the destination, then replace it atomically."""
    if result.get("complete") is not True or result.get("provider") not in ("gemini", "deepseek"):
        raise ValueError("Refusing to store incomplete or unattributed analysis")
    result = {**result, "text": clean_text(result.get("text"))}
    atomic_json(path, result)


def atomic_json(path, value):
    content = json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         delete=False) as output:
            temporary = output.name
            output.write(content)
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def finite_positive(*values):
    if not all(math.isfinite(v) and v > 0 for v in values):
        raise ValueError("Prices, capital and notionals must be finite and positive")


@dataclass
class Position:
    direction: int
    x: float
    y: float
    quantity_x: float
    quantity_y: float
    notional: float
    entry_cost: float
    entry_cycle: int | None = None


class Ledger:
    def __init__(self, capital, commission=COMMISSION_RATE, slippage=SLIPPAGE_RATE):
        finite_positive(capital)
        if not all(math.isfinite(v) and 0 <= v < 1 for v in (commission, slippage)):
            raise ValueError("Invalid cost rates")
        self.initial = self.capital = capital
        self.commission_rate, self.slippage_rate = commission, slippage
        self.commission_paid = self.slippage_paid = self.turnover = self.gross_pnl = 0.0
        self.position = None
        self.closed = []

    def charge(self, notional):
        commission = notional * self.commission_rate
        slippage = notional * self.slippage_rate
        self.commission_paid += commission
        self.slippage_paid += slippage
        self.turnover += notional
        return commission + slippage

    def enter(self, direction, x, y, notional, hedge_ratio, cycle=None):
        finite_positive(x, y, notional, hedge_ratio, self.capital)
        if self.position is not None or direction not in (-1, 1) or notional > self.capital:
            raise ValueError("Invalid position or insufficient capital")
        quantity_y = notional / (y + hedge_ratio * x)
        cost = self.charge(notional)
        self.capital -= cost
        self.position = Position(direction, x, y, hedge_ratio * quantity_y,
                                 quantity_y, notional, cost, cycle)

    def unrealized(self, x, y):
        finite_positive(x, y)
        p = self.position
        return 0.0 if p is None else p.direction * (
            p.quantity_y * (y - p.y) - p.quantity_x * (x - p.x))

    def exit_notional(self, x, y):
        p = self.position
        return 0.0 if p is None else abs(p.quantity_x * x) + abs(p.quantity_y * y)

    def equity(self, x, y):
        return self.capital + self.unrealized(x, y) - self.exit_notional(x, y) * (
            self.commission_rate + self.slippage_rate)

    def close(self, x, y, cycle=None):
        if self.position is None:
            raise ValueError("No open position")
        pnl = self.unrealized(x, y)
        notional = self.exit_notional(x, y)
        exit_cost = self.charge(notional)
        net = pnl - self.position.entry_cost - exit_cost
        # Principal was never removed from total equity: do NOT add it again.
        self.capital += pnl - exit_cost
        self.gross_pnl += pnl
        self.closed.append({"gross_pnl": pnl, "net_pnl": net,
                            "entry_cost": self.position.entry_cost, "exit_cost": exit_cost,
                            "direction": self.position.direction,
                            "entry_cycle": self.position.entry_cycle, "exit_cycle": cycle,
                            "entry_x": self.position.x, "entry_y": self.position.y,
                            "exit_x": x, "exit_y": y,
                            "entry_notional": self.position.notional, "exit_notional": notional})
        self.position = None
        return self.closed[-1]

    def accounting_seal(self):
        expected = self.initial + self.gross_pnl - self.commission_paid - self.slippage_paid
        return math.isfinite(self.capital) and math.isclose(
            self.capital, expected, rel_tol=1e-10, abs_tol=1e-8)


def compute_omega(net_return, laminar_rate, slippage_real, commission_effective,
                  residual_volatility, seal_s):
    """User's Ley 4105 formula. Missing observations remain unknown, never zero."""
    if laminar_rate is None or seal_s is not True or residual_volatility is None:
        return None
    values = (net_return, laminar_rate, slippage_real, commission_effective, residual_volatility)
    if not all(v is not None and math.isfinite(v) for v in values):
        raise ValueError("Omega inputs must be finite measured values")
    if not 0 <= laminar_rate <= 1 or min(slippage_real, commission_effective, residual_volatility) < 0:
        raise ValueError("Invalid Omega rates")
    return net_return * laminar_rate / (
        1 + (slippage_real + commission_effective) * residual_volatility)
