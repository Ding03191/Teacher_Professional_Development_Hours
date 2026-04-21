from .auth import auth_bp
from .core import core_bp
from .departments import departments_bp
from .teacher import teacher_bp

__all__ = [
    "auth_bp",
    "core_bp",
    "departments_bp",
    "teacher_bp",
]
