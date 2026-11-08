"""Offline persistence tests: never import or start the trading bot."""

import ast
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from maquina_4105_state import State, STATE_FILE

ROOT = Path(__file__).resolve().parents[1]


class TradingStateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "maquina_4105_state.json"
        self.state = State(state_file=self.path)

    def test_missing_file_does_not_create_a_fake_balance(self):
        self.assertFalse(self.state.load())
        self.assertFalse(self.path.exists())
        self.assertEqual(STATE_FILE, ROOT / "maquina_4105_state.json")

    def test_snapshot_matches_monitor_contract(self):
        self.state.save()
        data = json.loads(self.path.read_text())
        expected = {
            "status": "offline", "capital": 100, "pnl": 0,
            "trades": 0, "wins": 0, "losses": 0, "winrate": 0,
            "position": 0, "paused": False,
        }
        for key, value in expected.items():
            self.assertEqual(data[key], value)
        self.assertEqual(data["mode"], "paper")
        self.assertTrue(data["saved_at"].endswith("+00:00"))

    def test_online_percentage_and_paused_state(self):
        self.state.status = "online"
        self.state.capital = 49
        self.state.paused = True
        self.state.trades, self.state.wins, self.state.losses = 20, 13, 7
        self.state.save()
        data = json.loads(self.path.read_text())
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["winrate"], 65)
        self.assertEqual(data["pnl"], -51)
        self.assertTrue(data["paused"])

    def test_legacy_state_loads_without_inheriting_online(self):
        self.state.status = "online"
        self.state.position = -1
        self.state.entry_capital = 10
        self.state.entry_spread = 2.5
        self.state.hedge_ratio = 4
        self.state.save()
        data = json.loads(self.path.read_text())
        del data["status"]
        del data["winrate"]
        self.path.write_text(json.dumps(data))
        loaded = State(state_file=self.path)
        self.assertTrue(loaded.load())
        self.assertEqual(loaded.status, "offline")
        self.assertEqual(loaded.position, -1)
        self.assertEqual(loaded.entry_capital, 10)
        self.assertEqual(loaded.hedge_ratio, 4)
        loaded.save()
        self.assertIn("winrate", json.loads(self.path.read_text()))

    def test_failed_replace_preserves_existing_file_and_cleans_temp(self):
        self.state.save()
        original = self.path.read_bytes()
        self.state.capital = 105.5
        with patch("maquina_4105_state.os.replace", side_effect=OSError("simulated failure")):
            with self.assertRaises(OSError):
                self.state.save()
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_nan_never_overwrites_a_valid_snapshot(self):
        self.state.save()
        original = self.path.read_bytes()
        self.state.capital = float("nan")
        with self.assertRaises(ValueError):
            self.state.save()
        self.assertEqual(self.path.read_bytes(), original)

    def test_corrupt_or_invalid_state_is_not_reset_or_overwritten(self):
        for content in ("{", "null", "{}", '{"capital": NaN}'):
            with self.subTest(content=content):
                self.path.write_text(content)
                with self.assertRaises(ValueError):
                    self.state.load()
                self.assertEqual(self.path.read_text(), content)

    def test_open_position_requires_entry_accounting(self):
        self.state.save()
        data = json.loads(self.path.read_text())
        data["position"] = 1
        del data["entry_capital"]
        self.path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "entry_capital"):
            self.state.load()

    def test_bot_syntax_and_original_strategy_constants_without_import(self):
        source = (ROOT / "maquina_4105_v32.py").read_text()
        tree = ast.parse(source)
        literals = {
            node.targets[0].id: ast.literal_eval(node.value)
            for node in tree.body
            if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
            and isinstance(node.value, ast.Constant)
        }
        self.assertEqual(literals["MODE"], "PAPER")
        self.assertEqual(literals["COMISION"], 0.0025)
        self.assertEqual(literals["SLIPPAGE"], 0.0015)
        self.assertEqual(literals["MIN_CAPITAL_PROTECCION"], 50)
        self.assertIsInstance(tree.body[-1], ast.If)
        for module in ("maquina_4105_state.py", "scripts/test_maquina_4105_state.py"):
            ast.parse((ROOT / module).read_text())


if __name__ == "__main__":
    unittest.main()
