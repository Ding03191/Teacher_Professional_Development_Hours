from flask import Blueprint, jsonify, request, session

from ..db import dbStoring as db
from ..services.auth_service import (
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


@auth_bp.post("/register")
def register():
    data = request.json or {}
    unit_name = (data.get("unitName") or "").strip()
    account = (data.get("account") or "").strip().lower()
    password = data.get("password") or ""
    if not unit_name or not account or not password:
        return json_err("請提供單位名稱、帳號與密碼")

    dept = db.get_department_by_account(account)
    if not dept or dept[2] != unit_name:
        return json_err("單位名稱或帳號不正確，請確認是否在名單中")

    try:
        update_department_password(account, password)
    except Exception:
        return json_err("帳號更新失敗")
    return json_ok({"message": "註冊完成，請登入"})


@auth_bp.post("/login")
def login():
    data = request.json or {}
    unit_name = (data.get("unitName") or "").strip()
    account = (data.get("account") or "").strip().lower()
    password = data.get("password") or ""
    if unit_name and account:
        dept = db.get_department_by_account(account)
        if not dept or dept[2] != unit_name or not verify_department_password(dept, password):
            return json_err("登入資訊錯誤", 401)
        session.clear()
        session["uid"] = dept[0]
        role = "root" if dept[2] == "教學資源組" or dept[3] == "root" else "dept"
        session["role"] = role
        session["unit_name"] = dept[2]
        session["account"] = dept[3]
        return json_ok(
            {"user": {"id": dept[0], "unit_name": dept[2], "account": dept[3], "role": role}}
        )

    email = (data.get("email") or "").strip().lower()
    if email:
        row = get_user_by_email(email)
        if not verify_password(row, password):
            return json_err("帳號或密碼錯誤", 401)
        session.clear()
        session["uid"] = row[0]
        session["role"] = row[4]
        return json_ok({"user": {"id": row[0], "email": row[1], "name": row[2], "role": row[4]}})

    return json_err("缺少登入資訊")


@auth_bp.post("/logout")
def logout():
    session.clear()
    return json_ok({"message": "登出成功"})


@auth_bp.get("/me")
def me():
    if "uid" not in session:
        return json_err("尚未登入", 401)
    user = {"id": session["uid"], "role": session.get("role")}
    if session.get("role") == "dept":
        user["unit_name"] = session.get("unit_name")
        user["account"] = session.get("account")
    return json_ok({"user": user})
