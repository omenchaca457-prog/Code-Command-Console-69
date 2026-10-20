"""Bundle the existing chart runner and its tested core for standalone Library use."""
from pathlib import Path

IMPORT = "from runner_python_core import Ledger, ProviderFailure, analyze_with_fallback, atomic_json, compute_omega, save_analysis"


def build_snippet():
    directory = Path(__file__).parent
    runner = (directory / "runner_python.py").read_text(encoding="utf-8")
    if runner.count(IMPORT) != 1:
        raise ValueError("Expected exactly one core import; refusing an incomplete bundle")
    core = (directory / "runner_python_core.py").read_text(encoding="utf-8")
    code = core + "\n\n" + runner.replace(IMPORT, "# Core incluido arriba para Library; sin imports locales.")
    compile(code, "Library9_Runner_python", "exec")
    return code


if __name__ == "__main__":
    print(build_snippet(), end="")
