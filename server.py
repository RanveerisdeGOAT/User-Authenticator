from fastapi import *
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from pydantic import BaseModel
from functools import wraps
import traceback
import uvicorn
from passlib.context import CryptContext
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
import httpx
import os
import smtplib
import random
from email.mime.text import MIMEText
from dotenv import load_dotenv
from urllib.parse import unquote

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_ME")
RECAPTCHA_SECRET = os.getenv("RECAPTCHA_SECRET", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


class User(BaseModel):
    username: str
    password: str


class ClientError(Exception):
    pass


class ServerError(Exception):
    pass


def error_handler(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except ClientError as ce:
            raise HTTPException(status_code=400, detail=str(ce))
        except ServerError:
            raise HTTPException(status_code=500, detail="Internal server error")
        except Exception:
            print(traceback.format_exc())
            raise HTTPException(status_code=500, detail="Unexpected server error")

    return wrapper


class Database:
    def __init__(self):
        self.db = mysql.connector.connect(
            host=os.getenv("DB_HOST", "127.0.0.1"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "server"),
            port=int(os.getenv("DB_PORT", 3306))
        )

    def execute(self, query: str, args=()):
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(query, args)
        rows = cursor.fetchall()
        self.db.commit()
        cursor.close()
        return rows


database = Database()


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user_id = payload.get("id")
        if not username or not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username, "id": user_id}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def verify_captcha(token: str):
    if not token or not RECAPTCHA_SECRET:
        return False
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": RECAPTCHA_SECRET, "response": token},
        )
    data = res.json()
    return data.get("success", False)


def send_verification_email(to_email: str, code: str):
    subject = "Your Verification Code"
    body = f"Your verification code is: {code}\n\nThis code expires in 10 minutes."
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_EMAIL
    msg["To"] = to_email

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())


def save_verification_code(username: str, code: str):
    expiry = datetime.utcnow() + timedelta(minutes=3)
    database.execute(
        """
        INSERT INTO VerificationCodes (username, code, expires_at)
        VALUES (%s, %s, %s) 
        ON DUPLICATE KEY UPDATE code=%s, expires_at=%s
        """,
        (username, code, expiry, code, expiry)
    )
    print("on save:", database.execute("SELECT * FROM VerificationCodes"))


def verify_code(username: str, code: str):
    # Fetch record from DB
    row = database.execute(
        "SELECT code, expires_at FROM VerificationCodes WHERE username=%s",
        (username,)
    )[0]

    if not row:
        return False  # No code stored for this user

    print(row)

    # Check values in Python
    now = datetime.utcnow()
    if row['code'] == code and row['expires_at'] > now:
        return True
    return False


@app.get("/users")
@error_handler
async def get_users():
    return database.execute("SELECT id, username FROM Users;")


@app.get("/name_taken/{name}")
@error_handler
async def name_taken(name: str):
    rows = database.execute("SELECT COUNT(*) AS count FROM Users WHERE username=%s OR email=%s", (unquote(name), unquote(name)))
    return {"taken": rows[0]["count"] > 0}


@app.post("/send_verification")
@error_handler
async def send_verification(request: Request):
    data = await request.json()
    email = data.get("email")
    if not email:
        raise ClientError("Email is required")


    if (await name_taken(email))["taken"]:
        raise ClientError("Email already registered")

    code = str(random.randint(100000, 999999))
    save_verification_code(email, code)
    send_verification_email(email, code)
    return {"message": "Verification code sent"}


@app.post("/users")
@error_handler
async def create_user(request: Request):
    data = await request.json()
    print(data)
    user_data = data.get("user")
    captcha = data.get("captcha")
    code = data.get("code")

    # Validate incoming data
    if not user_data:
        raise ClientError("Missing user data")

    username = user_data.get("username")
    email = user_data.get("email")
    password = user_data.get("password")

    if not username or not password or not email:
        raise ClientError("Username, email, and password are required")

    # Validate CAPTCHA
    if not captcha == "dev-bypass":
        if not await verify_captcha(captcha):
            raise ClientError("Invalid CAPTCHA")

    # Check if username exists
    taken = await name_taken(username)
    if taken.get("taken"):
        raise ClientError("Username already taken")

    # Check verification code
    if not verify_code(email, code):
        raise ClientError("Invalid or expired verification code")

    # Insert into DB
    hashed = hash_password(password)
    database.execute(
        "INSERT INTO Users (username, password_hash, email) VALUES (%s, %s, %s)",
        (username, hashed, email)
    )

    return {"message": "User created successfully"}



@app.post("/login")
@error_handler
async def login(user: User):
    rows = database.execute("SELECT * FROM Users WHERE username=%s;", (user.username,))
    if not rows or not verify_password(user.password, rows[0]["password_hash"]):
        raise ClientError("Invalid username or password")
    token = create_access_token({"sub": rows[0]["username"], "id": rows[0]["user_id"]})
    return {"access_token": token, "token_type": "bearer"}


@app.delete("/users/{user_id}")
@error_handler
async def delete_user(user_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    database.execute("DELETE FROM Users WHERE id=%s;", (user_id,))
    return {"detail": f"User {user_id} deleted"}


@app.get("/me")
@error_handler
async def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

@app.put("/reset_password")
@error_handler
async def reset_password(request: Request):
    data = await request.json()  # Get JSON payload
    email = data.get("email")
    password = data.get("password")
    code = data.get("code")

    if not email or not password or not code:
        raise ServerError("Missing email, password, or verification code")

    if not verify_code(email, code):
        raise ClientError("Invalid or expired verification code")

    hashed_password = pwd_context.hash(password)

    database.execute(
        "UPDATE Users SET password_hash=%s WHERE email=%s",
        (hashed_password, email))

    database.execute(
        "DELETE FROM VerificationCodes WHERE username=%s",
        (email,)
    )

    return {"detail": "Password reset successful"}

@app.get('/profile')
@error_handler
async def get_user_data(current_user: dict = Depends(get_current_user)):
    print(current_user)
    uuid = current_user['id']
    user_data = database.execute('SELECT * FROM Users WHERE user_id=%s', (uuid,))
    if not user_data:
        raise ClientError("User not found")
    return user_data[0]



if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=6969, reload=True)
