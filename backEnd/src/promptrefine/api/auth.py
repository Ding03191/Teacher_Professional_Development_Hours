from flask import Blueprint, current_app, jsonify, request, session
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from ..db import dbStoring as db
from ..services.auth_service import (
    create_google_user,
    get_user_by_email,
    update_department_password,
    verify_department_password,
    verify_password,
)


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def json_ok(data=None, **kw):
    resp = {"ok": True}
    if data is not None:
        resp["data"] = data
    resp.update(kw)
    return jsonify(resp)


def json_err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code


def _is_root_department(dept_row):
    root_name = (current_app.config.get("ROOT_DEPARTMENT_NAME") or "").strip()
    return dept_row[3] == "root" or (root_name and dept_row[2] == root_name)


def _set_session_for_department(dept_row):
    session.clear()
    session["uid"] = dept_row[0]
    session["role"] = "root" if _is_root_department(dept_row) else "dept"
    session["unit_name"] = dept_row[2]
    session["account"] = dept_row[3]


def _set_session_for_user(row):
    session.clear()
    session["uid"] = row[0]
    session["role"] = row[4]
    session["email"] = row[1]
    session["name"] = row[2]


@auth_bp.get("/google/config")
def google_config():
    client_id = (current_app.config.get("GOOGLE_CLIENT_ID") or "").strip()
    hosted_domain = (current_app.config.get("GOOGLE_HOSTED_DOMAIN") or "").strip().lower()
    return json_ok(
        {"enabled": bool(client_id), "clientId": client_id, "hostedDomain": hosted_domain}
    )


@auth_bp.post("/register")
def register():
    data = request.json or {}
    unit_name = (data.get("unitName") or "").strip()
    account = (data.get("account") or "").strip().lower()
    password = data.get("password") or ""
    if not unit_name or not account or not password:
        return json_err("請輸入完整的單位、帳號與密碼")

    dept = db.get_department_by_account(account)
    if not dept or dept[2] != unit_name:
        return json_err("找不到對應的單位與帳號，請先確認資料")

    try:
        update_department_password(account, password)
    except Exception:
        return json_err("註冊失敗，請稍後再試")
    return json_ok({"message": "註冊完成，請使用新密碼登入"})


@auth_bp.post("/login")
def login():
    data = request.json or {}
    unit_name = (data.get("unitName") or "").strip()
    account = (data.get("account") or "").strip().lower()
    password = data.get("password") or ""

    if account:
        dept = db.get_department_by_account(account)
        if not dept:
            return json_err("帳號或密碼錯誤", 401)
        if unit_name and dept[2] != unit_name:
            return json_err("帳號或密碼錯誤", 401)
        if not verify_department_password(dept, password):
            return json_err("帳號或密碼錯誤", 401)
        _set_session_for_department(dept)
        return json_ok(
            {
                "user": {
                    "id": dept[0],
                    "unit_name": dept[2],
                    "account": dept[3],
                    "role": session["role"],
                }
            }
        )

    email = (data.get("email") or "").strip().lower()
    if email:
        row = get_user_by_email(email)
        if not verify_password(row, password):
            return json_err("帳號或密碼錯誤", 401)
        _set_session_for_user(row)
        return json_ok(
            {"user": {"id": row[0], "email": row[1], "name": row[2], "role": row[4]}}
        )

    return json_err("請提供登入資訊")


@auth_bp.post("/google")
def login_google():
    client_id = (current_app.config.get("GOOGLE_CLIENT_ID") or "").strip()
    if not client_id:
        return json_err("Google 登入尚未啟用", 503)

    data = request.json or {}
    credential = (data.get("credential") or "").strip()
    if not credential:
        return json_err("缺少 Google credential", 400)

    try:
        info = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), client_id
        )
    except Exception:
        return json_err("Google 驗證失敗", 401)

    if info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        return json_err("Google token issuer 無效", 401)
    if not info.get("email_verified"):
        return json_err("Google 信箱尚未驗證", 401)

    hosted_domain = (current_app.config.get("GOOGLE_HOSTED_DOMAIN") or "").strip().lower()
    token_hd = (info.get("hd") or "").strip().lower()
    if hosted_domain and token_hd != hosted_domain:
        return json_err("此 Google 帳號不在允許網域內", 403)

    email = (info.get("email") or "").strip().lower()
    name = (info.get("name") or "").strip() or email
    if not email:
        return json_err("Google 帳號缺少 email", 400)
    if not email.endswith("@ncut.edu.tw"):
        return json_err("僅允許 @ncut.edu.tw 信箱登入", 403)

    user = get_user_by_email(email)
    if not user:
        user_id = create_google_user(email=email, name=name, role="teacher")
        user = (user_id, email, name, "", "teacher")

    _set_session_for_user(user)
    return json_ok(
        {
            "user": {
                "id": session["uid"],
                "email": session.get("email"),
                "name": session.get("name"),
                "role": session.get("role"),
            }
        }
    )


@auth_bp.post("/logout")
def logout():
    session.clear()
    return json_ok({"message": "已登出"})


@auth_bp.get("/me")
def me():
    if "uid" not in session:
        return json_err("尚未登入", 401)
    user = {"id": session["uid"], "role": session.get("role")}
    if session.get("role") == "dept":
        user["unit_name"] = session.get("unit_name")
        user["account"] = session.get("account")
    else:
        user["email"] = session.get("email")
        user["name"] = session.get("name")
    return json_ok({"user": user})
