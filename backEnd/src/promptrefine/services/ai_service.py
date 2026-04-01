import os
import json
import re
import shutil
from urllib.parse import urlsplit, urlunsplit
from PyPDF2 import PdfReader
import pdfplumber
import openai
import requests
import pytesseract
import openpyxl
from PIL import Image, ImageEnhance, ImageOps  # 未來支援圖片上傳
# custom modules
from ..utils import functions as func
from ..utils.rag_utils import (
    create_vectorstore,
    load_persistent_vectorstore,
    retrieve_relevant_chunks,
    split_text_into_chunks,
)

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o")

# 設定 Tesseract 執行檔位置（Windows）
# 先看有沒有環境變數，沒有就用 C:\Tesseract-OCR\tesseract.exe
tesseract_path = (
    os.getenv("TESSERACT_CMD")
    or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    or shutil.which("tesseract")
)

if not tesseract_path or not os.path.exists(tesseract_path):
    # 不要整個程式直接 raise；先允許僅文字層解析，OCR 用到時再回報
    print("[WARN] 找不到 Tesseract，可讀 PDF 仍可處理；需要 OCR 時請安裝或設定 TESSERACT_CMD")
else:
    pytesseract.pytesseract.tesseract_cmd = tesseract_path
    print(f"使用 Tesseract 執行檔：{tesseract_path}")


def preprocess_image(img):
    # 灰階 + 自動對比 + 輕微銳化；避免強制反相（有些證書底色會被反轉）
    img = img.convert("L")
    img = ImageOps.autocontrast(img)
    # 放大 1.5 倍有助中文 OCR（LANCZOS）
    img = img.resize((int(img.width * 1.5), int(img.height * 1.5)), Image.Resampling.LANCZOS)
    # 適度銳化
    img = ImageEnhance.Sharpness(img).enhance(1.5)
    img = ImageEnhance.Contrast(img).enhance(1.3)
    return img


# 處理檔案
def extract_file_content(file_path, ocr_dpi=400):
    ext = os.path.splitext(file_path)[-1].lower()

    def _need_ocr(s: str) -> bool:
        # 找不到這些關鍵詞才啟用 OCR（避免多做工）
        keys = ["認證時數", "閱讀時數", "測驗成績", "通過標準", "學員姓名", "課程名稱"]
        return not any(k in (s or "") for k in keys)

    try:
        if ext == ".pdf":
            # 先抽文字層
            text = ""
            try:
                reader = PdfReader(file_path)
                text = "".join([p.extract_text() or "" for p in reader.pages])
            except Exception:
                text = ""

            if text and text.strip() and not _need_ocr(text):
                print(" 檔案為可讀文字型 PDF（已含關鍵字），暫不啟用 OCR")
                return text.strip()

            # 需要 OCR 時才進行；若未安裝 Tesseract，回傳友善訊息
            if not (pytesseract.pytesseract.tesseract_cmd and os.path.exists(pytesseract.pytesseract.tesseract_cmd)):
                return (text or "") + "\n[OCR 提示] 未偵測到 Tesseract，可讀文字已回傳；若需識別圖片內容請安裝 Tesseract 或設定 TESSERACT_CMD"

            print(f" 啟用 OCR 模式處理圖片/混合 PDF，dpi={ocr_dpi}")
            ocr_all = []
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    try:
                        img = page.to_image(resolution=ocr_dpi).original.convert("RGB")
                        processed = preprocess_image(img)
                        ocr_text = pytesseract.image_to_string(processed, lang="chi_tra+eng", config="--oem 3 --psm 6")
                        ocr_all.append(f"[頁面{i + 1}]\n{ocr_text}")
                    except Exception as e:
                        ocr_all.append(f"[頁面{i + 1}] OCR 發生錯誤：{e}")
            merged = (text or "") + "\n\n" + "\n".join(ocr_all)
            return merged.strip() or " OCR 無法辨識任何文字，請確認 PDF 清晰度與格式。"

        elif ext in [".png", ".jpg", ".jpeg"]:
            if not (pytesseract.pytesseract.tesseract_cmd and os.path.exists(pytesseract.pytesseract.tesseract_cmd)):
                return " [OCR 提示] 未偵測到 Tesseract，無法解析圖片。"
            image = Image.open(file_path).convert("RGB")
            processed = preprocess_image(image)
            ocr_text = pytesseract.image_to_string(processed, lang="chi_tra+eng", config="--oem 3 --psm 6")
            return ocr_text.strip()

        else:
            return f"Unsupported file type: {ext}"

    except Exception as e:
        return f" Error processing file: {e}"


_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_PROMPT_PATH = os.path.join(_BACKEND_DIR, "promptList", "applicationInstruciton.txt")
system_instructions = func.read_file_to_string(_PROMPT_PATH)

_RELEVANCE_PROMPT_PATH = os.path.join(_BACKEND_DIR, "promptList", "relevance_scoring.txt")
_ATTENDANCE_PROMPT_PATH = os.path.join(_BACKEND_DIR, "promptList", "attendance_scoring.txt")
relevance_instructions = func.read_file_to_string(_RELEVANCE_PROMPT_PATH)
attendance_instructions = func.read_file_to_string(_ATTENDANCE_PROMPT_PATH)


# with files
def analyze_with_gpt(file_content, instruction):
    try:
        response = openai.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": f"{instruction}\nHere is the file content:\n{file_content}"}
            ],
            temperature=0.5,  # temperature => AI回饋的多樣性，2是最高，0是最低
            max_tokens=16384,  # 基本上要翻Document看call哪支的 來確認maximum token
            top_p=0.95,  # top_p => AI抽樣機率分布的範圍，1是最高，0是最低
            frequency_penalty=0,  # frequency_penalty => -2是最低，2是最高 越高在單句的回覆內越不會重複同樣字眼
            presence_penalty=0  # presence_penalty => -2是最低，2是最高 越高在複數的回應內越不會重複同樣字眼 (對於有歷史對話影響較多)
        )
        if not response.choices or not response.choices[0].message:
            return "Error: GPT 沒有給出有效回應"

        func.tokenUsed(response.usage.total_tokens)
        res = response.choices[0].message.content
        return res

    except Exception as e:
        return f"Error during GPT analysis: {e}"


def analyze_with_gpt_rag(file_content, instruction):
    try:
        # 切段
        chunks = split_text_into_chunks(file_content)

        # 建立臨時向量資料庫
        vectorstore = create_vectorstore(chunks)

        # 語意檢索最相關的片段
        top_chunks = retrieve_relevant_chunks(vectorstore, instruction, k=5)
        if not top_chunks:
            return "Error: 無法從文件中找到相關內容"

        relevant_text = "\n---\n".join(top_chunks)

        # 丟給 GPT 處理
        response = openai.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": f"{instruction}\n\n以下是與此最相關的內容：\n{relevant_text}"}
            ],
            temperature=0.5,
            max_tokens=4096
        )

        # 防呆：確認 GPT 回應有效
        if not response.choices or not response.choices[0].message:
            return "Error: GPT 沒有有效回應內容"

        # 回傳分析結果
        func.tokenUsed(response.usage.total_tokens)
        return response.choices[0].message.content

    except Exception as e:
        return f"Error during GPT-RAG analysis: {e}"


def analyze_with_gpt_rag_mix(file_content, instruction):
    try:
        # 🔹1. 即時 chunks 處理
        chunks = split_text_into_chunks(file_content)
        instant_vectorstore = create_vectorstore(chunks)
        instant_chunks = retrieve_relevant_chunks(instant_vectorstore, instruction, k=3)

        # 🔹2. 常駐知識庫處理
        persistent_vectorstore = load_persistent_vectorstore(
            os.path.join(_BACKEND_DIR, "vectorstores", "knowledge_base")
        )
        persistent_chunks = retrieve_relevant_chunks(persistent_vectorstore, instruction, k=3)

        # 🔹3. 合併所有 chunks
        all_chunks = instant_chunks + persistent_chunks
        if not all_chunks:
            return "Error: 無法從任何資料中找到相關內容"

        relevant_text = "\n---\n".join(all_chunks)

        # 🔹4. 丟給 GPT
        response = openai.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": f"{instruction}\n\n以下是與此最相關的內容：\n{relevant_text}"}
            ],
            temperature=0.5,
            max_tokens=4096
        )

        # Debug：確認 GPT response 結構
        print(" GPT response:", response)

        # 防呆：避免 response.choices 為空
        if not response.choices or not response.choices[0].message:
            return "Error: GPT 沒有有效回應內容"

        # 正常回傳
        func.tokenUsed(response.usage.total_tokens)
        return response.choices[0].message.content

    except Exception as e:
        return f"Error during GPT-RAG-MIX analysis: {e}"


# attendance list extraction (pdf/xlsx)

def extract_attendance_content(file_path):
    ext = os.path.splitext(file_path)[-1].lower()
    if ext == ".pdf":
        return extract_file_content(file_path)
    if ext == ".xlsx":
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            parts = []
            for sheet in wb.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    row_vals = [str(v).strip() for v in row if v is not None and str(v).strip()]
                    if row_vals:
                        parts.append(" ".join(row_vals))
            return "\n".join(parts).strip()
        except Exception as e:
            return f"Error processing xlsx: {e}"
    return f"Unsupported file type: {ext}"


# parse JSON from model output

def _parse_json_response(text):
    raw = (text or "").strip()

    # 1) Prefer strict JSON parse first
    try:
        return json.loads(raw)
    except Exception:
        pass

    # 2) Handle markdown fenced JSON blocks
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1).strip()
        try:
            return json.loads(candidate)
        except Exception:
            pass

    # 3) Extract first JSON object from mixed text
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    # 4) Fallback: recover score/reason from plain text output
    score_match = re.search(r'(?:"score"|score)\s*[:=]\s*([0-5])', raw, re.IGNORECASE)
    reason_match = re.search(r'(?:"reason"|reason)\s*[:=]\s*["“]?(.+?)["”]?(?:,|\n|$)', raw, re.IGNORECASE)
    if score_match:
        score = int(score_match.group(1))
        reason = (reason_match.group(1).strip() if reason_match else "").strip()
        return {"score": score, "reason": reason}

    raise ValueError("Model response is not valid JSON")


def _coerce_relevance_result(text):
    raw = (text or "").strip()
    if not raw:
        return {"score": 0, "reason": "模型未回傳內容，請稍後重試。"}

    # try direct JSON parser first
    try:
        data = _parse_json_response(raw)
        score = int(data.get("score", 0))
        score = max(0, min(5, score))
        reason = str(data.get("reason", "")).strip()
        return {"score": score, "reason": reason}
    except Exception:
        pass

    # fallback patterns: "4/5", "score: 4", "分數 4"
    score = None
    m = re.search(r"([0-5])\s*/\s*5", raw)
    if m:
        score = int(m.group(1))
    if score is None:
        m = re.search(r"(?:score|分數)\s*[:：=]?\s*([0-5])", raw, re.IGNORECASE)
        if m:
            score = int(m.group(1))
    if score is None:
        m = re.search(r"\b([0-5])\b", raw)
        if m:
            score = int(m.group(1))
    if score is None:
        score = 0

    reason = raw.replace("\r", " ").replace("\n", " ").strip()
    if len(reason) > 120:
        reason = reason[:120] + "..."
    return {"score": max(0, min(5, score)), "reason": reason}


def _extract_completion_text(response):
    if not response or not getattr(response, "choices", None):
        return ""
    msg = response.choices[0].message
    if not msg:
        return ""
    content = (getattr(msg, "content", "") or "").strip()
    if content:
        return content
    # LM Studio may place output in reasoning with empty content.
    reasoning = (getattr(msg, "reasoning", "") or "").strip()
    return reasoning


def _derive_lm_native_chat_url(base_url):
    raw = (base_url or "").strip()
    if not raw:
        return ""
    parts = urlsplit(raw)
    path = (parts.path or "").rstrip("/")

    if path.endswith("/api/v1"):
        native_base = path
    elif path.endswith("/v1"):
        native_base = path[: -len("/v1")] + "/api/v1"
    elif not path:
        native_base = "/api/v1"
    else:
        native_base = path + "/api/v1"

    return urlunsplit((parts.scheme, parts.netloc, native_base + "/chat", "", ""))


def _extract_text_from_json_payload(payload):
    if payload is None:
        return ""

    # LM Studio REST v1 preferred shape:
    # {
    #   "output": [
    #     {"type":"reasoning","content":"..."},
    #     {"type":"message","content":"{\"score\":...}"}
    #   ]
    # }
    if isinstance(payload, dict):
        output = payload.get("output")
        if isinstance(output, list):
            # 1) Prefer assistant message content
            for item in output:
                if isinstance(item, dict) and item.get("type") == "message":
                    c = (item.get("content") or "").strip()
                    if c:
                        return c
            # 2) Then fallback to reasoning content
            for item in output:
                if isinstance(item, dict) and item.get("type") == "reasoning":
                    c = (item.get("content") or "").strip()
                    if c:
                        return c

    # OpenAI-like
    if isinstance(payload, dict):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            msg = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
            if isinstance(msg, dict):
                content = (msg.get("content") or "").strip()
                if content:
                    return content
                reasoning = (msg.get("reasoning") or "").strip()
                if reasoning:
                    return reasoning

    # LM Studio native variations: recursively find first useful text field.
    preferred_keys = ("content", "text", "output_text", "response", "reasoning")

    def walk(node):
        if isinstance(node, dict):
            for k in preferred_keys:
                v = node.get(k)
                if isinstance(v, str) and v.strip():
                    return v.strip()
            # Prefer traversing nested containers first; avoid returning arbitrary
            # scalar strings like `id`/`model` before real assistant content.
            nested_values = [v for v in node.values() if isinstance(v, (dict, list))]
            for v in nested_values:
                got = walk(v)
                if got:
                    return got
            for v in node.values():
                if isinstance(v, str):
                    continue
                got = walk(v)
                if got:
                    return got
        elif isinstance(node, list):
            for item in node:
                got = walk(item)
                if got:
                    return got
        return ""

    return walk(payload)


def _chat_with_lm_native_api(messages, max_tokens=400, temperature=0):
    base_url = os.getenv("OPENAI_BASE_URL", "")
    api_key = os.getenv("OPENAI_API_KEY", "")
    chat_url = _derive_lm_native_chat_url(base_url)
    if not chat_url:
        return "", "missing_base_url"

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # LM Studio REST v1 `/api/v1/chat` expects:
    # - `input`: string | array<object>
    # - `system_prompt`: string (optional)
    # - `max_output_tokens` instead of `max_tokens`
    system_prompt = ""
    input_items = []
    for m in messages or []:
        role = (m or {}).get("role")
        content = (m or {}).get("content")
        if not isinstance(content, str):
            continue
        if role == "system":
            system_prompt = (system_prompt + "\n" + content).strip() if system_prompt else content
        else:
            # keep as message-type input objects
            input_items.append({"type": "message", "content": content})

    payload = {
        "model": MODEL_NAME,
        "input": input_items,
        "temperature": temperature,
        "max_output_tokens": max_tokens,
        "store": False,
        "stream": False,
    }
    if system_prompt:
        payload["system_prompt"] = system_prompt

    def _post_and_parse(req_payload):
        res = requests.post(chat_url, headers=headers, json=req_payload, timeout=60)
        res.raise_for_status()
        try:
            body = res.json()
        except Exception:
            txt = (res.text or "").strip()
            return txt, ("" if txt else "lm_native_empty_text")
        txt = _extract_text_from_json_payload(body)
        return txt, ("" if txt else "lm_native_empty_payload")

    try:
        return _post_and_parse(payload)
    except requests.HTTPError as e:
        # fallback for older LM Studio builds: use plain text input format
        input_text = "\n\n".join(
            [item.get("content", "") for item in input_items if isinstance(item, dict)]
        ).strip()
        fallback_payload = {
            "model": MODEL_NAME,
            "input": input_text,
            "temperature": temperature,
            "max_output_tokens": max_tokens,
            "store": False,
            "stream": False,
        }
        if system_prompt:
            fallback_payload["system_prompt"] = system_prompt
        try:
            return _post_and_parse(fallback_payload)
        except Exception as e2:
            detail = ""
            try:
                detail = (e.response.text or "").strip()
            except Exception:
                detail = ""
            detail = detail[:180] if detail else str(e2)
            return "", f"lm_native_error: {detail}"
    except Exception as e:
        return "", f"lm_native_error: {e}"


def _shrink_evidence_text(text, max_chars=24000):
    raw = (text or "").strip()
    if len(raw) <= max_chars:
        return raw
    head = raw[: int(max_chars * 0.7)]
    tail = raw[-int(max_chars * 0.3):]
    return head + "\n\n[...內容過長，已節錄...]\n\n" + tail


# score relevance between explanation and evidence

def score_relevance(relevance_text, evidence_text):
    evidence_text = _shrink_evidence_text(evidence_text, max_chars=24000)
    user_content = (
        "Teaching growth description:\n"
        + (relevance_text or "")
        + "\n\n"
        + "Evidence content:\n"
        + (evidence_text or "")
    )
    messages = [
        {"role": "system", "content": relevance_instructions},
        {"role": "user", "content": user_content},
    ]
    content, native_err = _chat_with_lm_native_api(messages, max_tokens=400, temperature=0)
    result = _coerce_relevance_result(content)
    if result.get("score") == 0 and result.get("reason") == "模型未回傳內容，請稍後重試。":
        if native_err:
            result["reason"] = f"模型未回傳內容（{native_err}）"
    return result


# score attendance name match

def score_attendance(name, evidence_text):
    evidence_text = _shrink_evidence_text(evidence_text, max_chars=24000)
    user_content = (
        "Name provided:\n"
        + (name or "")
        + "\n\n"
        + "Attendance list content:\n"
        + (evidence_text or "")
    )
    messages = [
        {"role": "system", "content": attendance_instructions},
        {"role": "user", "content": user_content},
    ]
    content, native_err = _chat_with_lm_native_api(messages, max_tokens=400, temperature=0)
    result = _coerce_relevance_result(content)
    if result.get("score") == 0 and result.get("reason") == "模型未回傳內容，請稍後重試。":
        if native_err:
            result["reason"] = f"模型未回傳內容（{native_err}）"
    return result
