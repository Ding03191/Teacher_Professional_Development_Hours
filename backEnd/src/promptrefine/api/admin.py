from flask import Blueprint, jsonify, request, session

from ..db import dbStoring as db
from ..services.auth_service import create_user, get_user_by_email
from ..utils.authz import require_role


admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

VALID_ROLES = {"teacher", "staff", "root"}


def _ok(data=None, **kw):
    resp = {"ok": True}
    if data is not None:
        resp["data"] = data
    resp.update(kw)
    return jsonify(resp)


def _err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code


@admin_bp.get("/users")
@require_role("root")
def api_list_users():
    return _ok(db.list_users())


@admin_bp.post("/users")
@require_role("root")
def api_create_user():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""
    role = (data.get("role") or "teacher").strip()

    if not email or not name or not password:
        return _err("missing_required_fields")
    if role not in VALID_ROLES:
        return _err("invalid_role")
    if get_user_by_email(email):
        return _err("email_exists")

    try:
        uid = create_user(email, name, password, role)
    except Exception as exc:
        return _err(f"create_failed: {exc}", 500)

    return _ok({"id": uid, "email": email, "name": name, "role": role})


@admin_bp.patch("/users/<int:user_id>/role")
@require_role("root")
def api_update_role(user_id: int):
    data = request.get_json(silent=True) or {}
    role = (data.get("role") or "").strip()
    if role not in VALID_ROLES:
        return _err("invalid_role")

    if user_id == session.get("uid") and role != "root":
        return _err("cannot_change_self_role")

    target = db.get_user_by_id(user_id)
    if not target:
        return _err("user_not_found", 404)

    if target["role"] == "root" and role != "root":
        if db.count_users_by_role("root") <= 1:
            return _err("cannot_remove_last_root")

    db.update_user_role(user_id, role)
    return _ok({"id": user_id, "role": role})


@admin_bp.delete("/users/<int:user_id>")
@require_role("root")
def api_delete_user(user_id: int):
    if user_id == session.get("uid"):
        return _err("cannot_delete_self")

    target = db.get_user_by_id(user_id)
    if not target:
        return _err("user_not_found", 404)

    if target["role"] == "root":
        if db.count_users_by_role("root") <= 1:
            return _err("cannot_delete_last_root")

    db.delete_user(user_id)
    return _ok({"id": user_id, "deleted": True})
