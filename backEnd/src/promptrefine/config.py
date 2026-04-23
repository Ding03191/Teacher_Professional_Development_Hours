import os


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    APP_DEBUG = _as_bool(
        os.environ.get("APP_DEBUG", os.environ.get("FLASK_DEBUG")), False
    )
    SECRET_KEY = os.environ.get("SECRET_KEY")
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
    MAX_UPLOAD_SIZE = int(os.environ.get("MAX_UPLOAD_SIZE", 10 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {"pdf", "doc", "docx"}
    DEPT_DEFAULT_PASSWORD = os.environ.get("DEPT_DEFAULT_PASSWORD", "12345678")
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    GOOGLE_HOSTED_DOMAIN = os.environ.get("GOOGLE_HOSTED_DOMAIN", "").strip()

    # DB bootstrap settings
    DB_INIT_ON_START = _as_bool(os.environ.get("DB_INIT_ON_START"), True)
    DB_INIT_DEPARTMENTS_FROM_CSV = _as_bool(
        os.environ.get("DB_INIT_DEPARTMENTS_FROM_CSV"), True
    )
    DB_DEPARTMENTS_CSV_PATH = os.environ.get("DB_DEPARTMENTS_CSV_PATH")
    DB_INIT_ROOT_DEPARTMENT = _as_bool(os.environ.get("DB_INIT_ROOT_DEPARTMENT"), True)
    DB_INIT_ROOT_USER = _as_bool(os.environ.get("DB_INIT_ROOT_USER"), True)

    # Initial root account/department settings
    ROOT_EMAIL = os.environ.get("ROOT_EMAIL", "root")
    ROOT_PASSWORD = os.environ.get("ROOT_PASSWORD", "root1234")
    ROOT_NAME = os.environ.get("ROOT_NAME", "root")
    ROOT_DEPARTMENT_NAME = os.environ.get("ROOT_DEPARTMENT_NAME", "系統管理員")
    ROOT_DEPARTMENT_ACCOUNT = os.environ.get("ROOT_DEPARTMENT_ACCOUNT", "root")
    ROOT_DEPARTMENT_PASSWORD = os.environ.get(
        "ROOT_DEPARTMENT_PASSWORD", ROOT_PASSWORD
    )

    # LM Studio settings
    LM_STUDIO_BASE_URL = os.environ.get("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1")
    LM_STUDIO_MODEL = os.environ.get("LM_STUDIO_MODEL", "local-model")
    LM_STUDIO_API_KEY = os.environ.get("LM_STUDIO_API_KEY", "")
    LM_STUDIO_TIMEOUT_SECONDS = int(os.environ.get("LM_STUDIO_TIMEOUT_SECONDS", "30"))
