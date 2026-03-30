import sqlite3
import os
import shutil
import csv
import json
from werkzeug.security import generate_password_hash
# from datetime import datetime


_BASE_DIR = os.path.dirname(__file__)
_BACKEND_DIR = os.path.abspath(os.path.join(_BASE_DIR, "..", "..", ".."))
_LEGACY_DB_PATH = os.path.join(_BACKEND_DIR, "scoringHistory.sqlite")
_DEFAULT_DB_PATH = os.path.join(_BACKEND_DIR, "db", "scoringHistory.sqlite")
_DEFAULT_DEPT_CSV = os.path.join(_BACKEND_DIR, "the.csv")
DB_NAME = os.environ.get("DB_PATH", _DEFAULT_DB_PATH)
TABLE_NAME = 'history'
LABEL_TABLE_NAME = "history_labels"
DEPT_TABLE_NAME = "departments"
APP_TABLE_NAME = "applications"


def _ensure_db_path():
    os.makedirs(os.path.dirname(DB_NAME), exist_ok=True)
    if DB_NAME != _LEGACY_DB_PATH and (not os.path.exists(DB_NAME)) and os.path.exists(_LEGACY_DB_PATH):
        shutil.copy2(_LEGACY_DB_PATH, DB_NAME)


def _connect():
    _ensure_db_path()
    conn = sqlite3.connect(DB_NAME, timeout=30)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
    except Exception:
        pass
    return conn


# 1. Create the table if it doesn't exist
def init_db():
    conn = _connect()
    c = conn.cursor()
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            applicantStdn TEXT,
            applicantNo INTEGER,
            applicantName TEXT,
            file_name TEXT,
            pdf_path TEXT,
            isPassed BOOLEAN,
            aiFeedback TEXT,
            applyDate TEXT,
            applyTime TEXT,
            PRIMARY KEY (applicantStdn, applicantNo)
        )
    ''')
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS {LABEL_TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            applicantStdn TEXT NOT NULL,
            applicantNo INTEGER NOT NULL,

            labelIsCorrect INTEGER NOT NULL,     -- 1 = AI 判斷正確, 0 = 判錯
            correctedIsPassed BOOLEAN,           -- 人工修正後的 isPassed
            correctedFeedback TEXT,              -- 人工修正後的 aiFeedback

            reviewer TEXT,                       -- 標記人，例如 teacherA
            reviewComment TEXT,                  -- 備註
            labeledAt TEXT DEFAULT (datetime('now','localtime')),

            FOREIGN KEY (applicantStdn, applicantNo)
                REFERENCES {TABLE_NAME}(applicantStdn, applicantNo)
        )
    ''')

    c.execute(f'''
        CREATE TABLE IF NOT EXISTS {DEPT_TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_no INTEGER UNIQUE NOT NULL,
            unit_name TEXT NOT NULL,
            account TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS {APP_TABLE_NAME} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_type TEXT NOT NULL,
            unit_name TEXT NOT NULL,
            account TEXT NOT NULL,
            event_name TEXT,
            event_date TEXT,
            organizer TEXT,
            data_json TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            approved_hours REAL,
            review_comment TEXT,
            reviewed_by TEXT,
            reviewed_at TEXT,
            created_at DATETIME DEFAULT (datetime('now','localtime'))
        )
    ''')
    conn.commit()

    # Backward-compatible schema migration: add columns if old DB already exists.
    existing_cols = {row[1] for row in c.execute(f"PRAGMA table_info({TABLE_NAME})").fetchall()}
    for col, col_type in (("file_name", "TEXT"), ("pdf_path", "TEXT")):
        if col not in existing_cols:
            c.execute(f"ALTER TABLE {TABLE_NAME} ADD COLUMN {col} {col_type}")
    app_cols = {row[1] for row in c.execute(f"PRAGMA table_info({APP_TABLE_NAME})").fetchall()}
    for col, col_type in (
        ("status", "TEXT"),
        ("approved_hours", "REAL"),
        ("review_comment", "TEXT"),
        ("reviewed_by", "TEXT"),
        ("reviewed_at", "TEXT"),
    ):
        if col not in app_cols:
            c.execute(f"ALTER TABLE {APP_TABLE_NAME} ADD COLUMN {col} {col_type}")

    conn.commit()
    conn.close()


def insert_application(app_type: str, unit_name: str, account: str, data: dict, summary: dict | None = None):
    summary = summary or {}
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f'''
        INSERT INTO {APP_TABLE_NAME} (
            app_type, unit_name, account, event_name, event_date, organizer, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            app_type,
            unit_name,
            account,
            summary.get("event_name"),
            summary.get("event_date"),
            summary.get("organizer"),
            json.dumps(data, ensure_ascii=False),
        ),
    )
    conn.commit()
    app_id = c.lastrowid
    conn.close()
    return app_id


def list_applications(app_type: str | None = None, unit_name: str | None = None, account: str | None = None):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    clauses = []
    params = []
    if app_type and app_type != "all":
        clauses.append("app_type = ?")
        params.append(app_type)
    if unit_name and account:
        clauses.append("(unit_name = ? OR account = ?)")
        params.extend([unit_name, account])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    c.execute(
        f"""
        SELECT id, app_type, unit_name, account, event_name, event_date, organizer, data_json,
               status, approved_hours, review_comment, reviewed_by, reviewed_at, created_at
        FROM {APP_TABLE_NAME}
        {where}
        ORDER BY created_at DESC, id DESC
        """,
        params,
    )
    rows = c.fetchall()
    conn.close()
    records = []
    for row in rows:
        records.append(
            {
                "id": row["id"],
                "app_type": row["app_type"],
                "unit_name": row["unit_name"],
                "account": row["account"],
                "event_name": row["event_name"],
                "event_date": row["event_date"],
                "organizer": row["organizer"],
                "data": json.loads(row["data_json"] or "{}"),
                "status": (row["status"] or "pending"),
                "approved_hours": row["approved_hours"],
                "review_comment": row["review_comment"],
                "reviewed_by": row["reviewed_by"],
                "reviewed_at": row["reviewed_at"],
                "created_at": row["created_at"],
            }
        )
    return records


def get_application(app_id: int):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        f"""
        SELECT id, app_type, unit_name, account, event_name, event_date, organizer, data_json,
               status, approved_hours, review_comment, reviewed_by, reviewed_at, created_at
        FROM {APP_TABLE_NAME}
        WHERE id = ?
        """,
        (app_id,),
    )
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "app_type": row["app_type"],
        "unit_name": row["unit_name"],
        "account": row["account"],
        "event_name": row["event_name"],
        "event_date": row["event_date"],
        "organizer": row["organizer"],
        "data": json.loads(row["data_json"] or "{}"),
        "status": (row["status"] or "pending"),
        "approved_hours": row["approved_hours"],
        "review_comment": row["review_comment"],
        "reviewed_by": row["reviewed_by"],
        "reviewed_at": row["reviewed_at"],
        "created_at": row["created_at"],
    }


def update_application(app_id: int, data: dict, summary: dict | None = None):
    summary = summary or {}
    record = get_application(app_id)
    if record:
        existing = record.get("data") or {}
        if existing.get("attachments_files") and not data.get("attachments_files"):
            data["attachments_files"] = existing.get("attachments_files")
        if existing.get("attachments") and not data.get("attachments"):
            data["attachments"] = existing.get("attachments")
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"""
        UPDATE {APP_TABLE_NAME}
        SET event_name = ?, event_date = ?, organizer = ?, data_json = ?
        WHERE id = ?
        """,
        (
            summary.get("event_name"),
            summary.get("event_date"),
            summary.get("organizer"),
            json.dumps(data, ensure_ascii=False),
            app_id,
        ),
    )
    conn.commit()
    conn.close()


def update_application_review(
    app_id: int,
    status: str,
    approved_hours: float | None,
    reviewer: str | None,
    review_comment: str | None,
    reviewed_at: str | None,
):
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"""
        UPDATE {APP_TABLE_NAME}
        SET status = ?, approved_hours = ?, review_comment = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ?
        """,
        (status, approved_hours, review_comment, reviewer, reviewed_at, app_id),
    )
    conn.commit()
    conn.close()


def add_application_files(app_id: int, files_info: list[dict]):
    record = get_application(app_id)
    if not record:
        return
    data = record.get("data") or {}
    existing = data.get("attachments_files") or []
    data["attachments_files"] = existing + files_info
    update_application(
        app_id,
        data,
        {
            "event_name": record.get("event_name"),
            "event_date": record.get("event_date"),
            "organizer": record.get("organizer"),
        },
    )


def delete_application(app_id: int):
    conn = _connect()
    c = conn.cursor()
    c.execute(f"DELETE FROM {APP_TABLE_NAME} WHERE id = ?", (app_id,))
    conn.commit()
    conn.close()


def init_departments_from_csv(csv_path: str | None = None):
    path = csv_path or _DEFAULT_DEPT_CSV
    if not os.path.exists(path):
        return
    conn = _connect()
    c = conn.cursor()
    default_pwd = os.environ.get("DEPT_DEFAULT_PASSWORD", "12345678")
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # CSV headers are expected to be Chinese (see 123.csv). Support legacy garbled headers too.
            unit_no = (
                row.get("系統編號")
                or row.get("????")
                or row.get("??????")
                or ""
            ).strip()
            unit_name = (
                row.get("單位(使用者)名稱")
                or row.get("??(???)??")
                or row.get("???(????????")
                or ""
            ).strip()
            account = (
                row.get("帳號")
                or row.get("??")
                or row.get("???")
                or ""
            ).strip()
            password = (
                row.get("密碼")
                or ""
            ).strip()
            if not unit_no or not unit_name or not account:
                continue
            try:
                unit_no_int = int(unit_no)
            except Exception:
                continue
            pwd_hash = generate_password_hash(password or default_pwd)
            create_department(unit_no_int, unit_name, account, pwd_hash)
    conn.close()

# 2. Insert a record


def insert_scoring_result(data):
    conn = _connect()
    c = conn.cursor()

    c.execute(f'''
        INSERT INTO {TABLE_NAME} (
            applicantStdn,
            applicantNo,
            applicantName,
            file_name,
            pdf_path,
            isPassed,
            aiFeedback,
            applyDate,
            applyTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(applicantStdn, applicantNo) DO UPDATE SET
            applicantName = excluded.applicantName,
            file_name     = excluded.file_name,
            pdf_path      = excluded.pdf_path,
            isPassed      = excluded.isPassed,
            aiFeedback    = excluded.aiFeedback,
            applyDate     = excluded.applyDate,
            applyTime     = excluded.applyTime
    ''', (
        data['applicantStdn'],
        data['applicantNo'],
        data['applicantName'],
        data.get('file_name'),
        data.get('pdf_path'),
        int(data['isPassed']),  # Store boolean as 0 or 1
        data['aiFeedback'],
        data['applyDate'],
        data['applyTime']
    ))

    conn.commit()
    conn.close()

# 3. Optional: Fetch all history


def fetch_all_results():
    conn = _connect()
    c = conn.cursor()
    c.execute(f'SELECT * FROM {TABLE_NAME}')
    results = c.fetchall()
    conn.close()
    return results


def fetch_records_by_date(apply_date: str):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        f"""
        SELECT applicantStdn,
               applicantNo,
               applicantName,
               file_name,
               pdf_path,
               isPassed,
               aiFeedback,
               applyDate,
               applyTime
        FROM {TABLE_NAME}
        WHERE applyDate = ?
        ORDER BY applyTime
        """,
        (apply_date,),
    )
    rows = c.fetchall()
    conn.close()

    records = []
    for row in rows:
        records.append(
            {
                "applicantStdn": row["applicantStdn"],
                "applicantNo": row["applicantNo"],
                "applicantName": row["applicantName"],
                "file_name": row["file_name"],
                "pdf_path": row["pdf_path"],
                "isPassed": bool(row["isPassed"]),
                "aiFeedback": row["aiFeedback"],
                "applyDate": row["applyDate"],
                "applyTime": row["applyTime"],
            }
        )
    return records
# init_db()  # 已在 app.py 呼叫
# insert_scoring_result(your_json_dict)


# 4. 取回一筆「尚未被標記」的 history 記錄
def get_next_unlabeled_history():
    conn = _connect()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute(f'''
        SELECT h.applicantStdn,
               h.applicantNo,
               h.applicantName,
               h.file_name,
               h.pdf_path,
               h.isPassed,
               h.aiFeedback,
               h.applyDate,
               h.applyTime
        FROM {TABLE_NAME} AS h
        LEFT JOIN {LABEL_TABLE_NAME} AS l
          ON h.applicantStdn = l.applicantStdn
         AND h.applicantNo  = l.applicantNo
        WHERE l.id IS NULL          -- 尚未有標記資料
        ORDER BY h.applyDate, h.applyTime
        LIMIT 1
    ''')

    row = c.fetchone()
    conn.close()

    if row is None:
        return None

    # 轉成 Python dict，方便給 Flask jsonify
    return {
        "applicantStdn": row["applicantStdn"],
        "applicantNo": row["applicantNo"],
        "applicantName": row["applicantName"],
        "file_name": row["file_name"],
        "pdf_path": row["pdf_path"],
        "isPassed": bool(row["isPassed"]),
        "aiFeedback": row["aiFeedback"],
        "applyDate": row["applyDate"],
        "applyTime": row["applyTime"],
    }


# 5. 寫入一筆人工標記結果
def insert_label_result(label_data: dict):
    """
    label_data 格式示例：
    {
        "applicantStdn": "A123456789",
        "applicantNo": 1,
        "labelIsCorrect": True,
        "correctedIsPassed": True or False or None,
        "correctedFeedback": "修正後意見 or None",
        "reviewer": "teacherA",
        "reviewComment": "哪裡錯、為什麼錯"
    }
    """
    conn = _connect()
    c = conn.cursor()

    c.execute(f'''
        INSERT INTO {LABEL_TABLE_NAME} (
            applicantStdn,
            applicantNo,
            labelIsCorrect,
            correctedIsPassed,
            correctedFeedback,
            reviewer,
            reviewComment
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        label_data["applicantStdn"],
        label_data["applicantNo"],
        1 if label_data.get("labelIsCorrect") else 0,
        label_data.get("correctedIsPassed"),
        label_data.get("correctedFeedback"),
        label_data.get("reviewer"),
        label_data.get("reviewComment"),
    ))

    conn.commit()
    conn.close()


# === Users Table（登入用）===
def init_users_table():
    conn = _connect()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'teacher',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def get_conn():
    return _connect()


def create_department(unit_no: int, unit_name: str, account: str, password_hash: str):
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"""
        INSERT INTO {DEPT_TABLE_NAME} (unit_no, unit_name, account, password_hash)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(unit_no) DO UPDATE SET
            unit_name = excluded.unit_name,
            account = excluded.account,
            password_hash = excluded.password_hash
        """,
        (unit_no, unit_name.strip(), account.strip().lower(), password_hash),
    )
    conn.commit()
    conn.close()


def get_department_by_account(account: str):
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"SELECT id, unit_no, unit_name, account, password_hash, created_at FROM {DEPT_TABLE_NAME} WHERE account=?",
        (account.strip().lower(),),
    )
    row = c.fetchone()
    conn.close()
    return row


def update_department_password(account: str, password_hash: str):
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"UPDATE {DEPT_TABLE_NAME} SET password_hash=? WHERE account=?",
        (password_hash, account.strip().lower()),
    )
    conn.commit()
    conn.close()


def list_departments():
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"SELECT unit_no, unit_name, account FROM {DEPT_TABLE_NAME} ORDER BY unit_no"
    )
    rows = c.fetchall()
    conn.close()
    return [
        {"unit_no": r[0], "unit_name": r[1], "account": r[2]}
        for r in rows
    ]


def get_department_by_unit_name(unit_name: str):
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"SELECT id, unit_no, unit_name, account, password_hash, created_at FROM {DEPT_TABLE_NAME} WHERE unit_name=?",
        (unit_name.strip(),),
    )
    row = c.fetchone()
    conn.close()
    return row


def update_department_credentials(
    dept_id: int, unit_name: str, account: str, password_hash: str
):
    conn = _connect()
    c = conn.cursor()
    c.execute(
        f"""
        UPDATE {DEPT_TABLE_NAME}
        SET unit_name=?, account=?, password_hash=?
        WHERE id=?
        """,
        (unit_name.strip(), account.strip().lower(), password_hash, dept_id),
    )
    conn.commit()
    conn.close()


def ensure_root_department(unit_name: str, account: str, password: str):
    if not unit_name or not account or not password:
        return
    target = get_department_by_account(account)
    pwd_hash = generate_password_hash(password)
    if target:
        update_department_credentials(target[0], unit_name, account, pwd_hash)
        return
    target = get_department_by_unit_name(unit_name)
    if target:
        update_department_credentials(target[0], unit_name, account, pwd_hash)
        return
    # If no existing department matches, create a root department entry.
    create_department(0, unit_name, account, pwd_hash)


def create_user(email, name, password_hash, role='teacher'):
    conn = get_conn()
    c = conn.cursor()
    c.execute("INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,?)",
              (email.strip().lower(), name.strip(), password_hash, role))
    conn.commit()
    uid = c.lastrowid
    conn.close()
    return uid


def get_user_by_email(email):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id,email,name,password_hash,role,created_at FROM users WHERE email=?", (email.strip().lower(),))
    row = c.fetchone()
    conn.close()
    return row


def get_user_by_id(user_id: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id,email,name,role,created_at FROM users WHERE id=?", (user_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "name": row[2], "role": row[3], "created_at": row[4]}


def list_users():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id,email,name,role,created_at FROM users ORDER BY id")
    rows = c.fetchall()
    conn.close()
    return [
        {"id": r[0], "email": r[1], "name": r[2], "role": r[3], "created_at": r[4]}
        for r in rows
    ]


def update_user_role(user_id: int, role: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
    conn.commit()
    conn.close()


def delete_user(user_id: int):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE id=?", (user_id,))
    conn.commit()
    conn.close()


def count_users_by_role(role: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM users WHERE role=?", (role,))
    count = c.fetchone()[0]
    conn.close()
    return count


def ensure_root_user(email: str, password: str, name: str = "root"):
    if not email or not password:
        return
    if count_users_by_role("root") > 0:
        return
    if get_user_by_email(email):
        return
    password_hash = generate_password_hash(password)
    create_user(email, name, password_hash, role="root")
