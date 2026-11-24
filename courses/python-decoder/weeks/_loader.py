"""Load a week's lab, or its reference solution.

Two modes:
    pytest weeks/w01_prediction          -> uses your lab.py
    SOLUTION=1 pytest weeks/w01_prediction -> uses solutions/lab.py

Never read solutions/lab.py before your tests pass. It costs you the entire
point of the exercise, and you will not notice the loss.
"""
from __future__ import annotations

import importlib.util
import os
import pathlib
import sys


def load_lab(test_file: str):
    week = pathlib.Path(test_file).resolve().parent
    target = week / "solutions" / "lab.py" if os.environ.get("SOLUTION") == "1" else week / "lab.py"
    return load_module(target, f"lab_{week.name}")


def load_module(path: pathlib.Path, name: str):
    if not path.exists():
        raise FileNotFoundError(f"{path} missing -- did you delete the stub?")
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod
