import logging

from flask import Flask
from flask_cors import CORS
import openai

from .config import Config
from .db import dbStoring as db
from .api.core import core_bp
from .api.analyze import analyze_bp
from .api.label import label_bp
from .api.auth import auth_bp
from .api.teacher import teacher_bp
from .api.applications import applications_bp
from .api.departments import departments_bp
from .api.admin import admin_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, supports_credentials=True)

    if not app.config["SECRET_KEY"]:
        raise ValueError("Error: SECRET_KEY environment variable is not set!")

    openai.api_key = app.config["OPENAI_API_KEY"]
    if not openai.api_key:
        raise ValueError("Error: OPENAI_API_KEY environment variable is not set!")
    if app.config.get("OPENAI_BASE_URL"):
        openai.base_url = app.config["OPENAI_BASE_URL"]

    if app.config.get("DB_INIT_ON_START", True):
        db.init_db()
        db.init_users_table()

        if app.config.get("DB_INIT_DEPARTMENTS_FROM_CSV", True):
            db.init_departments_from_csv(app.config.get("DB_DEPARTMENTS_CSV_PATH"))

        if app.config.get("DB_INIT_ROOT_DEPARTMENT", True):
            db.ensure_root_department(
                app.config.get("ROOT_DEPARTMENT_NAME", "系統管理員"),
                app.config.get("ROOT_DEPARTMENT_ACCOUNT", "root"),
                app.config.get("ROOT_DEPARTMENT_PASSWORD", "root1234"),
            )

        if app.config.get("DB_INIT_ROOT_USER", True):
            db.ensure_root_user(
                app.config.get("ROOT_EMAIL", "root"),
                app.config.get("ROOT_PASSWORD", "root1234"),
                name=app.config.get("ROOT_NAME", "root"),
            )

    app.register_blueprint(core_bp)
    app.register_blueprint(analyze_bp)
    app.register_blueprint(label_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(teacher_bp)
    app.register_blueprint(departments_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(applications_bp)

    logging.getLogger(__name__).info("DB in use: %s", db.DB_NAME)
    return app
