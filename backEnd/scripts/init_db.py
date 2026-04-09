import argparse
import os
import sys


BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_DIR = os.path.join(BACKEND_DIR, "src")
if SRC_DIR not in sys.path:
    sys.path.insert(0, SRC_DIR)

from promptrefine.config import Config  # noqa: E402
from promptrefine.db import dbStoring as db  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser(description="Initialize project database manually.")
    parser.add_argument(
        "--skip-departments-csv",
        action="store_true",
        help="Skip importing departments from CSV.",
    )
    parser.add_argument(
        "--skip-root-department",
        action="store_true",
        help="Skip ensure root department.",
    )
    parser.add_argument(
        "--skip-root-user",
        action="store_true",
        help="Skip ensure root user.",
    )
    parser.add_argument(
        "--csv-path",
        default=Config.DB_DEPARTMENTS_CSV_PATH,
        help="Department CSV path override.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    db.init_db()
    db.init_users_table()

    if not args.skip_departments_csv and Config.DB_INIT_DEPARTMENTS_FROM_CSV:
        db.init_departments_from_csv(args.csv_path)

    if not args.skip_root_department and Config.DB_INIT_ROOT_DEPARTMENT:
        db.ensure_root_department(
            Config.ROOT_DEPARTMENT_NAME,
            Config.ROOT_DEPARTMENT_ACCOUNT,
            Config.ROOT_DEPARTMENT_PASSWORD,
        )

    if not args.skip_root_user and Config.DB_INIT_ROOT_USER:
        db.ensure_root_user(Config.ROOT_EMAIL, Config.ROOT_PASSWORD, name=Config.ROOT_NAME)

    print(f"[OK] DB initialized: {db.DB_NAME}")


if __name__ == "__main__":
    main()
