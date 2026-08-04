#!/usr/bin/env python3
"""Export compact, browser-runnable classifier weights to JSON.

Trains the two single-layer "logistic regression" models from the classifier
platform — MNIST (784 -> 10) and Iris (4 -> 3) — and dumps each model's weights
plus the EXACT normalisation constants the browser must reproduce, into
``public/classifiers/models/{mnist,iris}.json``. Those files drive the
zero-backend, in-browser inference demo (see ``public/classifiers/js/infer.js``):
draw a digit or enter flower measurements and the prediction runs entirely on the
client, no server awake.

This is a build/provenance tool, not part of the site's JS pipeline. It needs a
PyTorch environment (torch, torchvision, scikit-learn) — e.g. the classifier
repo's own virtualenv:

    ~/Projects/quantum-machine-learning/.venv/bin/python \\
        scripts/export-classifier-models.py

The weights are a real trained model; the printed test accuracies are the honest
numbers the site surfaces (no handwaving). Re-running is deterministic (seeded).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "classifiers" / "models"
# MNIST download cache, kept OUTSIDE the repo.
DATA_DIR = Path.home() / ".cache" / "classifier-web-export"

# Per-channel MNIST normalisation (matches the classifier platform's plugin).
MNIST_MEAN, MNIST_STD = 0.1307, 0.3081


def export_mnist() -> tuple[dict, float]:
    """Train logistic regression on MNIST and return (payload, test_accuracy)."""
    from torchvision import datasets, transforms

    tfm = transforms.Compose(
        [transforms.ToTensor(), transforms.Normalize((MNIST_MEAN,), (MNIST_STD,))]
    )
    train = datasets.MNIST(str(DATA_DIR), train=True, download=True, transform=tfm)
    test = datasets.MNIST(str(DATA_DIR), train=False, download=True, transform=tfm)
    train_loader = DataLoader(train, batch_size=128, shuffle=True)
    test_loader = DataLoader(test, batch_size=512, shuffle=False)

    model = nn.Linear(28 * 28, 10)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()

    model.train()
    for _ in range(5):
        for xb, yb in train_loader:
            opt.zero_grad()
            loss_fn(model(xb.flatten(1)), yb).backward()
            opt.step()

    model.eval()
    correct = total = 0
    with torch.no_grad():
        for xb, yb in test_loader:
            correct += (model(xb.flatten(1)).argmax(1) == yb).sum().item()
            total += yb.numel()
    acc = correct / total

    return {
        "kind": "linear",
        "dataset": "mnist",
        "input": 28 * 28,
        "classes": [str(i) for i in range(10)],
        # Client input is the 28x28 canvas grid (0-255): divide by scale, then
        # z-score with the (broadcast) mean/std.
        "normalize": {"scale": 255.0, "mean": [MNIST_MEAN], "std": [MNIST_STD]},
        "weight": model.weight.detach().tolist(),  # (10, 784)
        "bias": model.bias.detach().tolist(),  # (10,)
        "test_accuracy": round(acc, 4),
    }, acc


def export_iris() -> tuple[dict, float]:
    """Train logistic regression on Iris and return (payload, test_accuracy)."""
    from sklearn.datasets import load_iris
    from sklearn.model_selection import train_test_split

    d = load_iris()
    X = d.data.astype(np.float32)
    y = d.target.astype(np.int64)
    x_tr, x_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    x_tr_t = torch.from_numpy(x_tr)
    mean = x_tr_t.mean(dim=0)
    std = x_tr_t.std(dim=0).clamp(min=1e-8)
    x_tr_n = (x_tr_t - mean) / std
    x_te_n = (torch.from_numpy(x_te) - mean) / std
    y_tr_t = torch.from_numpy(y_tr)
    y_te_t = torch.from_numpy(y_te)

    model = nn.Linear(4, 3)
    opt = torch.optim.Adam(model.parameters(), lr=0.05)
    loss_fn = nn.CrossEntropyLoss()
    loader = DataLoader(TensorDataset(x_tr_n, y_tr_t), batch_size=16, shuffle=True)

    model.train()
    for _ in range(120):
        for xb, yb in loader:
            opt.zero_grad()
            loss_fn(model(xb), yb).backward()
            opt.step()

    model.eval()
    with torch.no_grad():
        acc = (model(x_te_n).argmax(1) == y_te_t).float().mean().item()

    return {
        "kind": "linear",
        "dataset": "iris",
        "input": 4,
        "classes": ["setosa", "versicolor", "virginica"],
        "features": ["sepal_length", "sepal_width", "petal_length", "petal_width"],
        "normalize": {"scale": 1.0, "mean": mean.tolist(), "std": std.tolist()},
        "weight": model.weight.detach().tolist(),  # (3, 4)
        "bias": model.bias.detach().tolist(),  # (3,)
        "test_accuracy": round(acc, 4),
        # Full-dataset min/max per feature — sensible slider bounds for the demo form.
        "feature_ranges": [[float(X[:, i].min()), float(X[:, i].max())] for i in range(4)],
    }, acc


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    torch.manual_seed(0)
    mnist, m_acc = export_mnist()
    (OUT_DIR / "mnist.json").write_text(json.dumps(mnist))
    m_kb = (OUT_DIR / "mnist.json").stat().st_size // 1024
    print(f"mnist.json  test_acc={m_acc:.4f}  ({m_kb} KB)")

    torch.manual_seed(0)
    iris, i_acc = export_iris()
    (OUT_DIR / "iris.json").write_text(json.dumps(iris))
    i_kb = (OUT_DIR / "iris.json").stat().st_size // 1024
    print(f"iris.json   test_acc={i_acc:.4f}  ({i_kb} KB)")


if __name__ == "__main__":
    main()
