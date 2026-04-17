import os
from flask import Blueprint, request, jsonify, session, send_file
from werkzeug.utils import secure_filename
from io import BytesIO
from pathlib import Path
from datetime import datetime
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from ..db import dbStoring as db
from ..utils.authz import require_role


applications_bp = Blueprint("applications", __name__, url_prefix="/api/applications")
_BACKEND_DIR = Path(__file__).resolve().parents[3]
UPLOAD_DIR = Path(os.environ.get("APP_UPLOAD_DIR", _BACKEND_DIR / "attachments" / "applications"))
EXCEL_TEMPLATE_PATH = _BACKEND_DIR / "ex.csv"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_UPLOAD_EXTS = {".pdf", ".xlsx", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
IMAGE_EXT_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
}


def _ok(data=None, **kw):
    resp = {"ok": True}
    if data is not None:
        resp["data"] = data
    resp.update(kw)
    return jsonify(resp)


def _err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code


def _is_owner(record):
    return bool(
        record
        and (
            record.get("unit_name") == session.get("unit_name")
            or record.get("account") == session.get("account")
        )
    )


def _wrap_text(text, max_len=32):
    text = (text or "").strip()
    if not text:
        return [""]
    lines = []
    buf = ""
    for ch in text:
        buf += ch
        if len(buf) >= max_len:
            lines.append(buf)
            buf = ""
    if buf:
        lines.append(buf)
    return lines


def _to_minutes(hhmm: str | None):
    if not hhmm or ":" not in hhmm:
        return None
    try:
        hh, mm = hhmm.split(":", 1)
        h = int(hh)
        m = int(mm)
    except Exception:
        return None
    if h < 0 or h > 23 or m < 0 or m > 59:
        return None
    return h * 60 + m


def _normalize_time_slots(raw_slots):
    if not isinstance(raw_slots, list):
        return []
    out = []
    for idx, raw in enumerate(raw_slots):
        if not isinstance(raw, dict):
            continue
        slot_date = (raw.get("slot_date") or raw.get("slotDate") or "").strip()
        start_time = (raw.get("start_time") or raw.get("startTime") or "").strip()
        end_time = (raw.get("end_time") or raw.get("endTime") or "").strip()
        s = _to_minutes(start_time)
        e = _to_minutes(end_time)
        if s is None or e is None or e <= s:
            return None
        out.append(
            {
                "slot_date": slot_date,
                "start_time": start_time,
                "end_time": end_time,
                "minutes": e - s,
                "sort_order": idx,
            }
        )
    return out


def _resolve_time_slots(app_type: str, data: dict, payload_slots):
    slots = _normalize_time_slots(payload_slots)
    if slots is None:
        return None
    if slots:
        return slots

    data_slots = _normalize_time_slots(data.get("timeSlots") or data.get("time_slots") or [])
    if data_slots is None:
        return None
    if data_slots:
        return data_slots

    start_time = (data.get("startTime") or "").strip()
    end_time = (data.get("endTime") or "").strip()
    s = _to_minutes(start_time)
    e = _to_minutes(end_time)
    if s is not None and e is not None and e > s:
        return [
            {
                "slot_date": (data.get("eventDateStart") or "").strip(),
                "start_time": start_time,
                "end_time": end_time,
                "minutes": e - s,
                "sort_order": 0,
            }
        ]
    if app_type == "out":
        return None
    return []


def _inject_time_slots_into_data(data: dict, time_slots: list):
    data["timeSlots"] = [
        {
            "slotDate": slot.get("slot_date") or "",
            "startTime": slot.get("start_time"),
            "endTime": slot.get("end_time"),
        }
        for slot in time_slots
    ]
    if time_slots:
        data["startTime"] = time_slots[0].get("start_time")
        data["endTime"] = time_slots[0].get("end_time")


def _build_form_pdf(record):
    try:
        pdfmetrics.registerFont(UnicodeCIDFont("MSung-Light"))
        font_name = "MSung-Light"
    except Exception:
        font_name = "Helvetica"
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40
    c.setFont(font_name, 14)
    title = f"申請紀錄（{'校內' if record['app_type']=='in' else '校外'}）"
    c.drawString(40, y, title)
    y -= 22
    c.setFont(font_name, 10)
    c.drawString(40, y, f"申請單位：{record.get('unit_name','')}")
    y -= 16
    c.drawString(40, y, f"申請日期：{record.get('event_date','')}")
    y -= 20

    data = record.get("data") or {}
    if record.get("app_type") == "in":
        fields = [
            ("主辦單位", data.get("organizerDept")),
            ("活動名稱", data.get("eventName")),
            ("主(承)辦人員", data.get("hostName")),
            ("聯絡電話（校內分機）", data.get("ext")),
            ("活動地點", data.get("location")),
            ("活動日期", data.get("eventDate")),
            (
                "活動時間",
                "；".join(
                    [
                        f"{(slot.get('slot_date') or '').strip()} {slot.get('start_time','')}～{slot.get('end_time','')}".strip()
                        for slot in (record.get("time_slots") or [])
                    ]
                )
                or f"{data.get('startTime','')} ～ {data.get('endTime','')}",
            ),
            ("是否核發研習證書", "是" if data.get("hasCert") == "yes" else "否"),
            ("證書字號", data.get("certNo")),
            ("鏈結領域", "、".join(data.get("domain") or [])),
            ("其他鏈結領域", data.get("domainOther")),
            ("對接 SDGs 指標", "、".join(data.get("sdg") or [])),
            ("一、活動主旨", data.get("purpose")),
            ("二、詳細活動內容", data.get("content")),
            ("三、教學專業關係", data.get("teachingRelation")),
            ("四、研究專業關係", data.get("researchRelation")),
            ("附件清單", "、".join(data.get("attachments") or [])),
        ]
    else:
        fields = [
            ("教師姓名", data.get("teacherName")),
            ("任教單位", data.get("department")),
            ("教師編號", data.get("teacherId")),
            ("聯絡分機", data.get("ext")),
            ("活動日期", data.get("eventDate")),
            (
                "活動時間",
                "；".join(
                    [
                        f"{(slot.get('slot_date') or '').strip()} {slot.get('start_time','')}～{slot.get('end_time','')}".strip()
                        for slot in (record.get("time_slots") or [])
                    ]
                )
                or f"{data.get('startTime','')} ～ {data.get('endTime','')}",
            ),
            ("活動課程名稱", data.get("courseTitle")),
            ("舉辦單位", data.get("organizer")),
            ("請具體舉證與專業成長之關係", data.get("relevance")),
            ("是否核發證書", "是" if data.get("hasCert") == "yes" else "否"),
            ("證書字號", data.get("certNo")),
            ("附件清單", "、".join(data.get("attachments") or [])),
        ]

    for label, text in fields:
        lines = _wrap_text(str(text or ""), 40)
        c.setFont(font_name, 10)
        c.drawString(40, y, f"{label}:")
        y -= 14
        for line in lines:
            c.drawString(60, y, line)
            y -= 14
            if y < 90:
                c.showPage()
                y = height - 40
        y -= 6

    c.setFont(font_name, 11)
    c.drawString(40, 70, "簽章與備註（列印後簽名）")
    c.setFont(font_name, 10)
    c.drawString(40, 54, "申請人（主辦人）________________")
    c.drawString(40, 40, "申請單位主管________________")
    c.drawString(280, 54, "處理人員________________")
    c.drawString(280, 40, "教學資源組組長________________")
    c.drawString(40, 26, "其他備註：________________________________")
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


@applications_bp.post("")
@require_role("dept")
def create_application():
    payload = request.get_json(silent=True) or {}
    app_type = (payload.get("app_type") or "").strip()
    data = payload.get("data") or {}
    summary = payload.get("summary") or {}
    if app_type not in ("in", "out"):
        return _err("invalid_type")
    if not isinstance(data, dict):
        return _err("invalid_data")
    time_slots = _resolve_time_slots(app_type, data, payload.get("time_slots"))
    if time_slots is None:
        return _err("invalid_time_slots")
    _inject_time_slots_into_data(data, time_slots)
    unit_name = session.get("unit_name") or ""
    account = session.get("account") or ""
    if not unit_name or not account:
        return _err("not_logged_in", 401)
    app_id = db.insert_application(app_type, unit_name, account, data, summary, time_slots=time_slots)
    return _ok({"id": app_id})


@applications_bp.get("")
@require_role("dept")
def list_applications():
    app_type = (request.args.get("type") or "all").strip()
    role = session.get("role")
    if role == "root":
        records = db.list_applications(app_type)
    else:
        records = db.list_applications(
            app_type, unit_name=session.get("unit_name"), account=session.get("account")
        )
    return _ok(records)


@applications_bp.get("/templates/excel")
def download_excel_template():
    if not EXCEL_TEMPLATE_PATH.exists():
        return _err("template_not_found", 404)
    return send_file(
        EXCEL_TEMPLATE_PATH,
        as_attachment=True,
        download_name="ex.csv",
        mimetype="text/csv; charset=utf-8",
    )


@applications_bp.get("/<int:app_id>")
@require_role("dept")
def get_application(app_id: int):
    record = db.get_application(app_id)
    if not record:
        return _err("not_found", 404)
    if session.get("role") != "root" and not _is_owner(record):
        return _err("forbidden", 403)
    return _ok(record)


@applications_bp.patch("/<int:app_id>")
@require_role("dept")
def update_application(app_id: int):
    record = db.get_application(app_id)
    if not record:
        return _err("not_found", 404)
    if session.get("role") != "root" and not _is_owner(record):
        return _err("forbidden", 403)
    payload = request.get_json(silent=True) or {}
    data = payload.get("data")
    summary = payload.get("summary")
    if not isinstance(data, dict):
        return _err("invalid_data")
    time_slots = _resolve_time_slots(record.get("app_type") or "", data, payload.get("time_slots"))
    if time_slots is None:
        return _err("invalid_time_slots")
    _inject_time_slots_into_data(data, time_slots)
    db.update_application(app_id, data, summary or {}, time_slots=time_slots)
    return _ok({"id": app_id})


@applications_bp.patch("/<int:app_id>/review")
@require_role("root")
def review_application(app_id: int):
    record = db.get_application(app_id)
    if not record:
        return _err("not_found", 404)
    payload = request.get_json(silent=True) or {}
    raw_status = str(payload.get("status") or "pending").strip().lower()
    status_alias = {
        "pending": "pending",
        "approved": "approved",
        "rejected": "rejected",
        "待審核": "pending",
        "通过": "approved",
        "通過": "approved",
        "退件": "rejected",
    }
    status = status_alias.get(raw_status, raw_status)
    if status not in ("pending", "approved", "rejected"):
        return _err("invalid_status")
    approved_hours = payload.get("approved_hours", None)
    if approved_hours == "":
        approved_hours = None
    if approved_hours is not None:
        try:
            approved_hours = float(approved_hours)
        except Exception:
            return _err("invalid_hours")
    review_comment = (payload.get("review_comment") or "").strip()
    reviewer = session.get("account") or session.get("unit_name") or "root"
    reviewed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.update_application_review(
        app_id, status, approved_hours, reviewer, review_comment, reviewed_at
    )
    return _ok({"id": app_id})


@applications_bp.delete("/<int:app_id>")
@require_role("dept")
def delete_application(app_id: int):
    record = db.get_application(app_id)
    if not record:
        return _err("not_found", 404)
    if session.get("role") != "root" and not _is_owner(record):
        return _err("forbidden", 403)
    db.delete_application(app_id)
    return _ok({"id": app_id})


@applications_bp.post("/<int:app_id>/files")
@require_role("dept")
def upload_files(app_id: int):
    record = db.get_application(app_id)
    if not record:
        return _err("not_found", 404)
    if session.get("role") != "root" and not _is_owner(record):
        return _err("forbidden", 403)
    if "files" not in request.files:
        return _err("no_files")
    files = request.files.getlist("files")
    saved = []
    for idx, f in enumerate(files):
        original_name = (f.filename or "").strip()
        ext = Path(original_name).suffix.lower()
        if not ext:
            continue
        if ext not in ALLOWED_UPLOAD_EXTS:
            return _err("only_supported_file_types")
        safe_name = secure_filename(original_name)
        if not safe_name:
            safe_name = f"file{idx + 1}{ext}"
        stamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        stored_name = f"{app_id}_{stamp}_{safe_name}"
        path = UPLOAD_DIR / stored_name
        f.save(path)
        saved.append({"name": original_name or safe_name, "path": str(path)})
    if saved:
        db.add_application_files(app_id, saved)
    return _ok({"files": saved})


@applications_bp.get("/<int:app_id>/print")
@require_role("dept")
def print_application(app_id: int):
    record = db.get_application(app_id)
    if not record:
        return _err("not_found", 404)
    if session.get("role") != "root" and not _is_owner(record):
        return _err("forbidden", 403)

    writer = PdfWriter()
    form_pdf = _build_form_pdf(record)
    form_reader = PdfReader(form_pdf)
    for page in form_reader.pages:
        writer.add_page(page)

    data = record.get("data") or {}
    for info in data.get("attachments_files") or []:
        path = info.get("path")
        if not path:
            continue
        try:
            reader = PdfReader(path)
            for page in reader.pages:
                writer.add_page(page)
        except Exception:
            continue

    out = BytesIO()
    writer.write(out)
    out.seek(0)
    return send_file(out, mimetype="application/pdf", as_attachment=False, download_name="application.pdf")


@applications_bp.get("/<int:app_id>/files/<int:file_index>")
@require_role("dept")
def download_file(app_id: int, file_index: int):
    record = db.get_application(app_id)
    if not record:
        return _err("not_found", 404)
    if session.get("role") != "root" and not _is_owner(record):
        return _err("forbidden", 403)
    data = record.get("data") or {}
    files = data.get("attachments_files") or []
    if file_index < 0 or file_index >= len(files):
        return _err("file_not_found", 404)
    info = files[file_index]
    path = info.get("path")
    if not path:
        return _err("file_not_found", 404)
    filename = info.get("name") or "attachment.pdf"
    inline = (request.args.get("inline") or "").lower() in ("1", "true", "yes")
    ext = Path(filename).suffix.lower()
    is_pdf = ext == ".pdf"
    image_mime = IMAGE_EXT_TO_MIME.get(ext)
    return send_file(
        path,
        as_attachment=not (inline and (is_pdf or image_mime is not None)),
        download_name=filename,
        mimetype=(
            "application/pdf"
            if (inline and is_pdf)
            else image_mime if (inline and image_mime is not None) else None
        ),
    )
