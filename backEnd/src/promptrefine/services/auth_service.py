import os

from werkzeug.security import check_password_hash, generate_password_hash

from ..db import dbStoring as db


def create_user(email, name, password, role="teacher"):
    password_hash = generate_password_hash(password)
    return db.create_user(email, name, password_hash, role)


def get_user_by_email(email):
    return db.get_user_by_email(email)


def verify_password(row, password):
    return row and check_password_hash(row[3], password)


def verify_department_password(row, password):
    return row and check_password_hash(row[4], password)


def update_department_password(account: str, password: str):
    password_hash = generate_password_hash(password)
    db.update_department_password(account, password_hash)


def create_google_user(email: str, name: str, role: str = "teacher"):
    # Random local hash so OAuth users still satisfy existing schema.
    password_hash = generate_password_hash(os.urandom(32).hex())
    return db.create_user(email, name, password_hash, role)
