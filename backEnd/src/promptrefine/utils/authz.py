from functools import wraps

from flask import jsonify, session


def require_role(*roles):
    allowed = set(roles)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            role = session.get("role")
            if not session.get("uid") or not role:
                return jsonify({"ok": False, "error": "not_logged_in"}), 401
            if role != "root" and role not in allowed:
                return jsonify({"ok": False, "error": "forbidden"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
