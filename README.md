# 教師成長平台

這是教師專業成長申請與審核的全端原型。前端為靜態 HTML/CSS/JS，
後端為 Flask API，資料存 SQLite，並使用 OpenAI 進行分析。

## 專案結構
- `frontEnd/public/teacher.html`: 教師申請表（前端列印成 PDF）。
- `frontEnd/public/teacher_in.html`: 校內活動表（前端驗證）。
- `frontEnd/src/css`, `frontEnd/src/js`: 前端資源。
- `backEnd/app.py`: Flask 入口。
- `backEnd/src/promptrefine`: API、服務與 DB 輔助。
- `backEnd/db/scoringHistory.sqlite`: 預設 SQLite 位置。

## 需求
- 建議 Python 3.10+
- 前端為靜態頁面，不需要 Node
- OCR 相關系統套件（選用）：Tesseract + Poppler（`pdf2image` 用）

## 後端啟動（本機）
```powershell
cd backEnd
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:SECRET_KEY = "dev-secret"
$env:OPENAI_API_KEY = "your-openai-key"
python app.py
```

後端會在 `http://localhost:5000` 啟動。

## Docker Compose（後端 + 前端）
```powershell
Copy-Item .env.example .env
# 編輯 .env，填入 SECRET_KEY / OPENAI_API_KEY
docker compose up --build
```

- 後端：`http://localhost:5000`
- 前端：`http://localhost:8080/teacher.html` 或 `http://localhost:8080/teacher_in.html`
- 管理頁：`http://localhost:8080/admin.html`（僅 root 可用）

## 前端使用
- 直接開啟 `frontEnd/public/teacher.html` 使用教師申請表。
- 直接開啟 `frontEnd/public/teacher_in.html` 使用校內活動表。
- 直接開啟 `frontEnd/public/admin.html` 使用權限管理頁（需 root 登入）。

前端為純前端流程，列印時用瀏覽器的列印功能輸出 PDF。

## 主要 API
- `GET /`: 健康檢查
- `GET /api/query_records?date=YYYY-MM-DD`: 依日期查詢紀錄
- `POST /python-api/analyzeApplication`: 上傳檔案並進行 AI 分析
- `POST /predict`: RAG + 商業規則欄位判斷
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/auth/me`: 取得登入資訊
- `GET /api/label/next`, `POST /api/label/submit`: 人工標註流程
- `POST /api/departments/bulk_create`: 批次建立單位帳號
- `GET /api/admin/users`: 列出使用者（root）
- `POST /api/admin/users`: 新增使用者（root）
- `PATCH /api/admin/users/{id}/role`: 更新角色（root）
- `DELETE /api/admin/users/{id}`: 刪除使用者（root）

## 環境變數
- `SECRET_KEY`（必要）：Flask session secret
- `OPENAI_API_KEY`（必要）：OpenAI API key
- `MAX_UPLOAD_SIZE`（選用，bytes）：預設 10 MB
- `DB_PATH`（選用）：SQLite 路徑，預設 `backEnd/db/scoringHistory.sqlite`
- `DEPT_DEFAULT_PASSWORD`（選用）：單位預設密碼

## 備註
- 上傳檔案會存放於 `backEnd/attachments`。
- SQLite 資料表在第一次啟動時自動建立。
- 角色包含 `teacher` / `staff` / `root`，root 擁有最高權限。
