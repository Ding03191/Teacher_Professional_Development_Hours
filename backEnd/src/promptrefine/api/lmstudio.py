import re

import requests
from flask import Blueprint, current_app, jsonify, request

from ..utils.authz import require_role


lmstudio_bp = Blueprint("lmstudio", __name__, url_prefix="/api/lmstudio")


def _ok(data=None):
    resp = {"ok": True}
    if data is not None:
        resp["data"] = data
    return jsonify(resp)


def _err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code


def _safe_text(value):
    if value is None:
        return ""
    return str(value).strip()


def _extract_score(text):
    if not text:
        return None
    # Prefer direct 0-100 integer in JSON style text.
    m = re.search(r'"score"\s*:\s*(\d{1,3})', text)
    if m:
        score = int(m.group(1))
        return max(0, min(100, score))
    # Fallback: first integer 0-100 in output.
    m = re.search(r"\b(\d{1,3})\b", text)
    if m:
        score = int(m.group(1))
        if 0 <= score <= 100:
            return score
    return None


def _build_prompt(item):
    return (
        "你是教師專業成長時數審核助理。"
        "請判斷以下申請內容與『教師專業成長』的相關度（0~100）。"
        "分數越高代表越相關。\n\n"
        f"活動名稱: {_safe_text(item.get('event_name'))}\n"
        f"活動日期: {_safe_text(item.get('event_date'))}\n"
        f"申請類型: {_safe_text(item.get('app_type'))}\n"
        f"單位: {_safe_text(item.get('unit_name'))}\n"
        f"內容: {_safe_text(item.get('content'))}\n\n"
        '請只輸出 JSON，格式為 {"score": 0-100, "reason": "不超過60字"}。'
    )


def _call_lmstudio(base_url, model, api_key, prompt, timeout):
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": "你是嚴謹的評分模型。"},
            {"role": "user", "content": prompt},
        ],
    }
    res = requests.post(url, headers=headers, json=payload, timeout=timeout)
    res.raise_for_status()
    data = res.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    return _safe_text(content)


@lmstudio_bp.post("/relevance/score-batch")
@require_role("root")
def score_batch():
    payload = request.get_json(silent=True) or {}
    raw_items = payload.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        return _err("items_required")

    cfg_base = current_app.config.get("LM_STUDIO_BASE_URL") or "http://127.0.0.1:1234/v1"
    cfg_model = current_app.config.get("LM_STUDIO_MODEL") or "local-model"
    cfg_timeout = int(current_app.config.get("LM_STUDIO_TIMEOUT_SECONDS") or 30)
    cfg_api_key = current_app.config.get("LM_STUDIO_API_KEY") or ""

    base_url = _safe_text(payload.get("base_url")) or cfg_base
    model = _safe_text(payload.get("model")) or cfg_model
    api_key = _safe_text(payload.get("api_key")) or cfg_api_key
    timeout = payload.get("timeout_seconds")
    if timeout is None:
        timeout = cfg_timeout
    try:
        timeout = max(5, min(120, int(timeout)))
    except Exception:
        timeout = cfg_timeout

    results = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        app_id = item.get("id")
        prompt = _build_prompt(item)
        try:
            raw = _call_lmstudio(base_url, model, api_key, prompt, timeout)
            score = _extract_score(raw)
            results.append(
                {
                    "id": app_id,
                    "score": score,
                    "reason": raw[:500],
                    "raw": raw,
                }
            )
        except Exception as exc:
            results.append(
                {
                    "id": app_id,
                    "score": None,
                    "reason": f"lmstudio_error: {exc}",
                    "raw": "",
                }
            )

    return _ok(
        {
            "count": len(results),
            "base_url": base_url,
            "model": model,
            "results": results,
        }
    )
