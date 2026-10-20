import json
import math
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from build_runner_snippet import build_snippet
from runner_python_core import (
    Ledger, ProviderFailure, analyze_with_fallback, clean_text, compute_omega,
    request_provider, save_analysis,
)


def gemini(text="Completo", finish="STOP"):
    return {"candidates": [{"finishReason": finish, "content": {"parts": [{"text": text}]}}]}


def deepseek(text="Completo", finish="stop"):
    return {"choices": [{"finish_reason": finish, "message": {"content": text}}]}


class ProviderTests(unittest.TestCase):
    def test_503_retries_then_deepseek_fallback_with_provenance(self):
        calls, delays = [], []

        def transport(provider, key, prompt, attempt, timeout):
            calls.append((provider, attempt, timeout))
            if provider == "gemini":
                raise ProviderFailure("http_503")
            return deepseek("OK")

        result = analyze_with_fallback("Prueba", "test-g", "test-d", transport, delays.append, timeout=3)
        self.assertEqual(calls, [("gemini", 1, 3), ("gemini", 2, 3), ("deepseek", 1, 3)])
        self.assertEqual(delays, [0.75])
        self.assertEqual(result["provider"], "deepseek")
        self.assertTrue(result["complete"])
        self.assertEqual(result["attempts"], {"gemini": 2, "deepseek": 1})
        self.assertIn("gemini:http_503", result["fallback_reasons"])

    def test_empty_and_cut_responses_are_not_accepted(self):
        calls = []

        def transport(provider, key, prompt, attempt, timeout):
            calls.append(provider)
            if provider == "gemini":
                return gemini("", "STOP") if attempt == 1 else gemini("partial", "MAX_TOKENS")
            return deepseek("partial", "length") if attempt == 1 else deepseek("\x1bOK\x00")

        result = analyze_with_fallback("Prueba", "g", "d", transport, lambda _: None)
        self.assertEqual(calls, ["gemini", "gemini", "deepseek", "deepseek"])
        self.assertEqual(result["text"], "OK")

    def test_timeouts_are_bounded_and_do_not_expose_credentials(self):
        with patch("urllib.request.urlopen", side_effect=TimeoutError("private-key")):
            with self.assertRaisesRegex(ProviderFailure, "^connection_or_timeout$"):
                request_provider("gemini", "private-key", "Prueba", 1, 0.1)
        error = urllib.error.HTTPError("https://example.test", 503, "private-key", {}, None)
        with patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaisesRegex(ProviderFailure, "^http_503$"):
                request_provider("gemini", "private-key", "Prueba", 1, 0.1)

    def test_auth_errors_do_not_retry_and_all_failure_is_explicit(self):
        calls = []

        def transport(provider, *args):
            calls.append(provider)
            raise ProviderFailure("http_403", False)

        with self.assertRaisesRegex(ProviderFailure, "no_valid_analysis"):
            analyze_with_fallback("Prueba", "g", "d", transport, lambda _: None)
        self.assertEqual(calls, ["gemini", "deepseek"])

    def test_validate_before_atomic_storage_preserves_previous_good_result(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "analysis.json"
            good = {"complete": True, "provider": "deepseek", "text": "\x00OK\n"}
            save_analysis(path, good)
            previous = path.read_text()
            self.assertEqual(json.loads(previous)["text"], "OK")
            for bad in ({"complete": False, "provider": "gemini", "text": "partial"},
                        {"complete": True, "provider": "gemini", "text": "\x00  "}):
                with self.assertRaises((ValueError, ProviderFailure)):
                    save_analysis(path, bad)
                self.assertEqual(path.read_text(), previous)

    def test_no_silent_prompt_truncation(self):
        with self.assertRaises(ValueError):
            analyze_with_fallback("x" * 60001)
        with self.assertRaises(ProviderFailure):
            clean_text(" \x00")


class AccountingTests(unittest.TestCase):
    def test_round_trip_charges_both_legs_both_sides_without_duplicating_principal(self):
        ledger = Ledger(1000)
        ledger.enter(1, 100, 200, 300, 1)
        self.assertAlmostEqual(ledger.equity(100, 200), 997.6)
        trade = ledger.close(100, 200)
        self.assertAlmostEqual(ledger.capital, 997.6)
        self.assertAlmostEqual(trade["net_pnl"], -2.4)
        self.assertAlmostEqual(ledger.turnover, 600)
        self.assertAlmostEqual(ledger.commission_paid, 1.5)
        self.assertAlmostEqual(ledger.slippage_paid, 0.9)
        self.assertTrue(ledger.accounting_seal())

    def test_frozen_leg_quantities_use_actual_price_changes_and_net_wins(self):
        ledger = Ledger(1000)
        ledger.enter(1, 100, 200, 300, 1)
        trade = ledger.close(95, 210)
        self.assertAlmostEqual(trade["gross_pnl"], 15)
        self.assertAlmostEqual(trade["net_pnl"], 12.58)
        self.assertAlmostEqual(ledger.capital, 1012.58)
        self.assertTrue(ledger.accounting_seal())
        short = Ledger(1000)
        short.enter(-1, 100, 200, 300, 1)
        self.assertAlmostEqual(short.close(105, 190)["gross_pnl"], 15)

    def test_invalid_market_inputs_do_not_change_capital(self):
        ledger = Ledger(1000)
        for x, y, size in ((float("nan"), 2, 10), (0, 2, 10), (1, 2, 1001)):
            with self.assertRaises(ValueError):
                ledger.enter(1, x, y, size, 1)
            self.assertEqual(ledger.capital, 1000)


class OmegaTests(unittest.TestCase):
    def test_user_formula_uses_fractional_rates_without_clamping_losses(self):
        expected = 0.1 * 0.8 / (1 + (0.0015 + 0.0025) * 0.02)
        self.assertAlmostEqual(compute_omega(0.1, 0.8, 0.0015, 0.0025, 0.02, True), expected)
        self.assertLess(compute_omega(-0.1, 0.8, 0.0015, 0.0025, 0.02, True), 0)

    def test_unknown_evidence_is_not_fabricated_as_zero_or_stability(self):
        self.assertIsNone(compute_omega(0.1, None, 0.0015, 0.0025, 0.02, True))
        self.assertIsNone(compute_omega(0.1, 0.8, 0.0015, 0.0025, 0.02, None))
        with self.assertRaises(ValueError):
            compute_omega(0.1, 1.1, 0.0015, 0.0025, 0.02, True)
        with self.assertRaises(ValueError):
            compute_omega(math.nan, 0.8, 0.0015, 0.0025, 0.02, True)

    def test_standalone_library_bundle_executes_without_local_imports(self):
        with tempfile.TemporaryDirectory() as directory:
            code, report = Path(directory) / "library9.py", Path(directory) / "report.json"
            code.write_text(build_snippet(), encoding="utf-8")
            # Managed Runner can advertise DISPLAY while actually using Agg and pipes.
            with patch.dict("os.environ", {"DISPLAY": ":99", "MPLBACKEND": "Agg"}):
                result = subprocess.run([sys.executable, str(code), "--no-ai-probe", "--cycles", "200",
                                         "--report", str(report)], capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            value = json.loads(report.read_text())
            self.assertEqual(value["cycles"], 200)
            self.assertTrue(value["accounting_conservation"])
            self.assertEqual(value["execution_state"], "stable")
            self.assertIsNone(value["omega_nucleo"])
            self.assertEqual(value["omega_state"], "N/D")
            self.assertAlmostEqual(value["final_capital"], value["initial_capital"] +
                                   value["gross_pnl"] - value["commission_paid"] - value["slippage_paid"])
            self.assertGreater(value["closed_trades"], 0)
            evidence = Path(directory) / "fixture-evidence.json"
            evidence.write_text(json.dumps({
                "criterion": "Synthetic test fixture only, not observed market evidence",
                "laminar_operations": [True] * value["closed_trades"], "seal_s": True,
            }))
            measured = subprocess.run([sys.executable, str(code), "--headless", "--no-ai-probe",
                                       "--cycles", "200", "--report", str(report),
                                       "--coherence-evidence", str(evidence)],
                                      capture_output=True, text=True, timeout=30)
            self.assertEqual(measured.returncode, 0, measured.stderr)
            result = json.loads(report.read_text())
            self.assertAlmostEqual(result["omega_nucleo"], compute_omega(
                result["net_return"], 1, result["slippage_real"],
                result["commission_effective"], result["residual_volatility"], True))
            self.assertEqual(result["omega_state"], "measured_simulation_no_stability_threshold")


if __name__ == "__main__":
    unittest.main()
