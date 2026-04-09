# 教師成長時數平台

教師專業成長申請與審核系統（前後端分離）。

- 前端：`HTML / CSS / JavaScript`（靜態頁面）
- 後端：`Flask` API
- 資料庫：`SQLite`
- AI 相關分析：透過後端服務串接 OpenAI

---

## 1. 功能概覽

- 教師可填寫校內、校外活動申請表
- 可查看歷史紀錄
- 管理者（`root`）可進行時數審核
- 管理者（`root`）可進入「使用者管理」頁面，查看與管理所有帳號
- 一般使用者不可看見、不可進入「使用者管理」頁面

---

## 2. 角色與權限

- `teacher`：一般教師使用者
- `staff`：一般行政/單位使用者
- `root`：最高權限管理者

### 權限規則

- 只有 `root` 看得到側邊欄的 `時數審核`、`使用者管理`
- 只有 `root` 可呼叫使用者管理 API（`/api/admin/users`）
- 非 `root` 若直接輸入 `user_management.html`，會被導回一般頁面

---

## 3. 專案結構

```text
Teacher_Professional_Development_Hours/
├─ frontEnd/
│  ├─ public/
│  │  ├─ admin.html               # 登入頁（不再包含使用者管理面板）
│  │  ├─ teacher.html             # 校外申請
│  │  ├─ teacher_in.html          # 校內申請
│  │  ├─ history.html             # 歷史紀錄
│  │  ├─ review.html              # 時數審核（root）
│  │  └─ user_management.html     # 使用者管理（root）
│  └─ src/
│     ├─ css/
│     │  ├─ layout.css
│     │  └─ user_management.css
│     └─ js/
│        ├─ auth_guard.js
│        ├─ admin.js
│        └─ user_management.js
├─ backEnd/
│  ├─ app.py
│  └─ src/promptrefine/
└─ README.md
```

---

## 4. 環境需求

- Python `3.10+`（建議）
- 前端為靜態檔案，不強制需要 Node.js
- Docker（若使用 docker compose）
- OCR（選用）：Tesseract + Poppler（`pdf2image` 相關流程）

---

## 5. 本機啟動（後端）

```powershell
cd backEnd
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:SECRET_KEY = "dev-secret"
$env:OPENAI_API_KEY = "your-openai-key"
python app.py
```

後端預設啟動：`http://localhost:5000`

### 手動初始化資料庫（建議流程）

目前預設 `DB_INIT_ON_START=false`，不會在啟動後端時自動初始化。
請先手動執行：

```powershell
cd backEnd
python scripts/init_db.py
```

可選參數：

```powershell
# 不匯入系所 CSV
python scripts/init_db.py --skip-departments-csv

# 不建立 root 單位 / root 使用者
python scripts/init_db.py --skip-root-department --skip-root-user

# 指定 CSV 路徑
python scripts/init_db.py --csv-path "C:\path\to\the.csv"
```

---

## 6. Docker Compose 啟動

```powershell
docker compose up --build
```

常用頁面：

- 前端登入頁：`http://localhost:5051/admin.html`
- 校外申請：`http://localhost:5051/teacher.html`
- 校內申請：`http://localhost:5051/teacher_in.html`
- 使用者管理（root）：`http://localhost:5051/user_management.html`

---

## 7. 前端頁面說明

- `admin.html`：帳號登入頁（登入後依角色導向）
- `teacher.html`：校外活動申請
- `teacher_in.html`：校內活動申請
- `history.html`：申請歷史紀錄
- `review.html`：時數審核（root）
- `user_management.html`：使用者管理（root）

---

## 8. 主要 API

### 系統/資料

- `GET /`：健康檢查
- `GET /api/query_records?date=YYYY-MM-DD`：依日期查詢紀錄

### AI / 分析

- `POST /python-api/analyzeApplication`：上傳檔案並進行 AI 分析
- `POST /predict`：RAG + 規則判斷

### 認證

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 標註與單位

- `GET /api/label/next`
- `POST /api/label/submit`
- `POST /api/departments/bulk_create`

### 使用者管理（root）

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{id}/role`
- `DELETE /api/admin/users/{id}`

---

## 9. 環境變數

- `SECRET_KEY`（必要）：Flask Session 金鑰
- `OPENAI_API_KEY`（必要）：OpenAI 金鑰
- `APP_DEBUG`（選用）：後端 debug 模式，開發可設 `true`，正式建議 `false`
- `MAX_UPLOAD_SIZE`（選用，bytes）：預設 `10 MB`
- `DB_PATH`（選用）：SQLite 路徑（預設 `backEnd/db/scoringHistory.sqlite`）
- `DEPT_DEFAULT_PASSWORD`（選用）：單位預設密碼
- `DB_INIT_ON_START`（選用）：是否啟動時執行資料庫初始化（預設 `false`）
- `DB_INIT_DEPARTMENTS_FROM_CSV`（選用）：是否從 CSV 匯入單位資料（預設 `true`）
- `DB_DEPARTMENTS_CSV_PATH`（選用）：單位 CSV 路徑，未填則使用 `backEnd/the.csv`
- `DB_INIT_ROOT_DEPARTMENT`（選用）：是否建立/更新 root 單位資料（預設 `true`）
- `DB_INIT_ROOT_USER`（選用）：是否建立 root 使用者（預設 `true`）
- `ROOT_EMAIL`（選用）：root 帳號（預設 `root`）
- `ROOT_PASSWORD`（選用）：root 密碼（預設 `root1234`）
- `ROOT_NAME`（選用）：root 顯示名稱（預設 `root`）
- `ROOT_DEPARTMENT_NAME`（選用）：root 單位名稱（預設 `系統管理員`）
- `ROOT_DEPARTMENT_ACCOUNT`（選用）：root 單位帳號（預設 `root`）
- `ROOT_DEPARTMENT_PASSWORD`（選用）：root 單位密碼（預設同 `ROOT_PASSWORD`）

---

## 10. 注意事項

- 請使用 `UTF-8` 編碼儲存前端檔案，避免中文顯示為 `?`
- 上傳附件預設存放於 `backEnd/attachments`
- SQLite 資料表會在第一次啟動時建立
