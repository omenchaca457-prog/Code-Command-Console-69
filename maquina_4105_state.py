"""Persistence for the paper bot; importing this module never starts trading."""

import json
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

STATE_FILE = Path(__file__).resolve().with_suffix(".json")


class State:
    def __init__(self, initial_capital=100.0, state_file=STATE_FILE):
        self.initial_capital = initial_capital
        self.state_file = Path(state_file).resolve()
        self.status = "offline"
        self.capital = initial_capital
        self.position = 0
        self.entry_spread = 0.0
        self.entry_capital = 0.0
        self.hedge_ratio = 0.0
        self.trades = 0
        self.wins = 0
        self.losses = 0
        self.max_capital = initial_capital
        self.paused = False
        self.history = []

    @property
    def winrate(self):
        # Preserve the uploaded bot's definition: trades counts entries.
        return (self.wins / self.trades * 100) if self.trades else 0.0

    def save(self):
        if self.status not in ("online", "offline"):
            raise ValueError("Estado del proceso no válido.")
        data = {
            "status": self.status,
            "mode": "paper",
            "capital": round(self.capital, 2),
            "position": self.position,
            "entry_spread": self.entry_spread,
            "entry_capital": self.entry_capital,
            "hedge_ratio": self.hedge_ratio,
            "trades": self.trades,
            "wins": self.wins,
            "losses": self.losses,
            "winrate": round(self.winrate, 4),
            "paused": self.paused,
            "pnl": round(self.capital - self.initial_capital, 2),
            "history": self.history[-50:],
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        # Serialize before touching disk. Reject NaN/Infinity rather than
        # creating a file that the JSON API cannot parse.
        payload = json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False)
        temporary = None
        try:
            # Same directory => same filesystem, so replace is atomic.
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=self.state_file.parent,
                prefix=f".{self.state_file.name}.", suffix=".tmp", delete=False,
            ) as stream:
                temporary = Path(stream.name)
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.state_file)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def load(self):
        try:
            data = json.loads(self.state_file.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return False
        except (OSError, ValueError) as error:
            # A corrupt saved balance must not silently become a new $100 account.
            raise ValueError("No se pudo cargar el estado; se conserva el archivo original.") from error
        if not isinstance(data, dict):
            raise ValueError("El estado guardado debe ser un objeto JSON.")

        defaults = {
            "capital": self.initial_capital, "position": 0, "entry_spread": 0.0,
            "entry_capital": 0.0, "hedge_ratio": 0.0, "trades": 0,
            "wins": 0, "losses": 0, "paused": False, "history": [],
        }
        values = {key: data.get(key, value) for key, value in defaults.items()}
        # Only an absent file starts a new account. Existing incomplete files
        # must not erase an existing balance or an open position.
        for key in ("capital", "position", "trades", "wins", "losses", "paused"):
            if key not in data:
                raise ValueError(f"Falta {key} en el estado guardado.")
        for key in ("capital", "entry_spread", "entry_capital", "hedge_ratio"):
            value = values[key]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"{key} no es una métrica finita.")
        for key in ("trades", "wins", "losses"):
            value = values[key]
            if type(value) is not int or not 0 <= value <= 2**53 - 1:
                raise ValueError(f"{key} no es un contador válido para el panel.")
        if type(values["position"]) is not int or values["position"] not in (-1, 0, 1):
            raise ValueError("Posición guardada inválida.")
        if not isinstance(values["paused"], bool) or not isinstance(values["history"], list):
            raise ValueError("Protección o historial guardado inválido.")
        if values["position"] != 0:
            for key in ("entry_spread", "entry_capital", "hedge_ratio"):
                if key not in data:
                    raise ValueError(f"Falta {key} para recuperar la posición abierta.")
            if values["entry_capital"] <= 0:
                raise ValueError("La posición abierta no tiene capital de entrada válido.")
        for key, value in values.items():
            setattr(self, key, value)
        self.max_capital = max(self.capital, self.initial_capital)
        # Never inherit an old process's online flag; run() owns the lifecycle.
        self.status = "offline"
        return True
