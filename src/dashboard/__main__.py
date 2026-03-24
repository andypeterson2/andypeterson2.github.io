"""Entry point: python -m dashboard"""

from pathlib import Path


def main() -> None:
    from dashboard.app import DashboardApp
    from dashboard.config import find_config, load_config

    config_path = find_config(Path(__file__).resolve().parents[2])
    config = load_config(config_path)
    app = DashboardApp(config=config)
    app.run()


if __name__ == "__main__":
    main()
