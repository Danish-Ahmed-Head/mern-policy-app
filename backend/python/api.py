import os
import sys
import socket
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from chatbot import load_policy_cache, load_faiss_index, create_qa_chain
from datetime import datetime, timedelta
from loguru import logger
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
import uvicorn
import psutil
import jwt
import smtplib
from email.mime.text import MIMEText
import json
import tempfile

# Configure logging
logger.add("api.log", level="DEBUG", rotation="10 MB", retention="5 days")

# Load environment variables
load_dotenv()
app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
MODEL_PATH = os.getenv("MODEL_PATH", r"D:\1FYP\bot version\Latest Bot 30-may-2025\ChatBot using Langchain\models\Phi-3-mini-4k-instruct-v0.3-Q4_K_M.gguf")
JWT_SECRET = os.getenv("JWT_SECRET", "your_jwt_secret")
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

# Initialize MongoDB
try:
    mongo_client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=5000)
    mongo_client.admin.command('ping')  # Test connection
    db = mongo_client["policyDB"]
    prompt_history = db["promptHistory"]
    logger.info("MongoDB connection initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize MongoDB connection: {str(e)}")
    raise SystemExit(f"MongoDB connection failed: {str(e)}")

# Initialize policy cache
try:
    logger.info(f"Checking MODEL_PATH: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        logger.error(f"Model file {MODEL_PATH} does not exist")
        raise FileNotFoundError(f"Model file {MODEL_PATH} does not exist")
    logger.debug(f"Memory usage before loading policy cache: {psutil.Process().memory_info().rss / 1024**2:.2f} MB")
    logger.info("Loading policy cache...")
    policy_chunks, all_policy_types = load_policy_cache()
    if not policy_chunks:
        logger.warning("No policies found in MongoDB. Chatbot may have limited functionality.")
    logger.info(f"Policy cache loaded with keys: {list(policy_chunks.keys())}")
    logger.debug(f"Memory usage after loading policy cache: {psutil.Process().memory_info().rss / 1024**2:.2f} MB")
except Exception as e:
    logger.error(f"Failed to initialize policy cache: {str(e)}")
    raise SystemExit(f"Policy cache initialization failed: {str(e)}")

def check_port(host='0.0.0.0', port=8000):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            logger.info(f"Port {port} is available")
        except socket.error as e:
            logger.error(f"Port {port} is already in use: {e}")
            sys.exit(1)

async def authenticate_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Invalid token")
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        logger.warning("Invalid token")
        raise HTTPException(status_code=401, detail="Invalid token")

active_sessions = {}

class InitChatRequest(BaseModel):
    session_id: str
    position_id: str
    username: str
    experience: str = "N/A"

class ChatRequest(BaseModel):
    session_id: str
    question: str

class ChatSaveRequest(BaseModel):
    userQuery: str
    botResponse: str
    sessionId: str
    positionId: str
    experience: str
    username: str

class CollectionData(BaseModel):
    data: list

class RecordData(BaseModel):
    data: dict

class LoginRequest(BaseModel):
    username: str
    password: str

class ForgotRequest(BaseModel):
    name: str
    username: str
    issue: str

# Global exception handler to ensure CORS headers on errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server error: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "http://localhost:3000"}
    )

@app.post("/api/auth/login")
async def login(data: LoginRequest):
    try:
        user = db["users"].find_one({"username": data.username})
        if not user:
            logger.warning(f"Login failed: User {data.username} not found")
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        if user["password"] != data.password:
            logger.warning(f"Login failed: Incorrect password for {data.username}")
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        token = jwt.encode(
            {"username": user["username"], "role": user["role"], "positionId": user["positionId"]},
            JWT_SECRET,
            algorithm="HS256"
        )
        logger.info(f"User {data.username} logged in successfully")
        return {
            "token": token,
            "username": user["username"],
            "role": user["role"],
            "positionId": user["positionId"],
            "position": user.get("position", ""),
            "experience": user.get("experience", "N/A")
        }
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/api/auth/forgot")
async def forgot_password(data: ForgotRequest):
    try:
        db["forgotRequests"].insert_one({
            "name": data.name,
            "username": data.username,
            "issue": data.issue,
            "requestDate": datetime.now()
        })
        msg = MIMEText(f"Forgot password request from {data.name} ({data.username}): {data.issue}")
        msg["Subject"] = "Forgot Password Request"
        msg["From"] = EMAIL_USER
        msg["To"] = EMAIL_USER
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)
        logger.debug(f"Forgot password request submitted for {data.username}")
        return {"message": "Forgot password request submitted"}
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.get("/api/policy/collections", dependencies=[Depends(authenticate_token)])
async def get_collections():
    try:
        collections = db.list_collection_names()
        filtered_collections = [name for name in collections if name not in ["promptHistory", "forgotRequests"]]
        logger.debug(f"Fetched collections: {filtered_collections}")
        return filtered_collections
    except Exception as e:
        logger.error(f"Error fetching collections: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching collections: {str(e)}")

@app.get("/api/policy/collection/{collection_id}", dependencies=[Depends(authenticate_token)])
async def get_collection_data(collection_id: str):
    try:
        cursor = db[collection_id].find()
        data = []
        for doc in cursor:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
            data.append(doc)
        logger.debug(f"Fetched {len(data)} documents from {collection_id}")
        return data
    except Exception as e:
        logger.error(f"Error fetching collection data for {collection_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching collection data: {str(e)}")

@app.post("/api/policy/collection/{collection_id}", dependencies=[Depends(authenticate_token)])
async def manage_collection(collection_id: str, data: CollectionData, action: str = "create"):
    try:
        if not data.data or not isinstance(data.data, list):
            logger.warning(f"Invalid data format for {collection_id}")
            raise HTTPException(status_code=400, detail="Invalid data format")
        collection = db[collection_id]
        if action in ["create", "insert"]:
            collection.insert_many(data.data)
            logger.debug(f"{'Created' if action == 'create' else 'Inserted'} {len(data.data)} documents in {collection_id}")
            return {"message": f"Collection {collection_id} {'created' if action == 'create' else 'inserted'} successfully", "restart_required": True}
        elif action == "update":
            collection.delete_many({})
            collection.insert_many(data.data)
            logger.debug(f"Updated {collection_id} with {len(data.data)} documents")
            return {"message": f"Collection {collection_id} updated successfully", "restart_required": True}
        else:
            logger.warning(f"Invalid action: {action}")
            raise HTTPException(status_code=400, detail="Invalid action")
    except Exception as e:
        logger.error(f"Error processing collection {collection_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing collection: {str(e)}")

@app.get("/api/policy/health-policies", dependencies=[Depends(authenticate_token)])
async def get_health_policies(positionId: str = None, experience: str = None):
    try:
        query = {"status": "Active"}
        if positionId:
            query["positionId"] = positionId
        if experience:
            query["ExperienceRange"] = experience
        policies = list(db["health_policies"].find(query, {"_id": 0}))
        logger.debug(f"Fetched {len(policies)} health policies")
        return policies
    except Exception as e:
        logger.error(f"Error fetching health policies: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching health policies: {str(e)}")

@app.get("/api/chat/history")
async def get_chat_history(username: str, _=Depends(authenticate_token)):
    try:
        if not username:
            logger.warning("Username is required for chat history")
            raise HTTPException(status_code=400, detail="Username is required")
        history = list(db["promptHistory"].find({"username": username}, {"_id": 0}).sort("queryDate", -1).limit(50))
        logger.debug(f"Fetched {len(history)} chat history entries for {username}")
        return history
    except Exception as e:
        logger.error(f"Error fetching chat history for {username}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching chat history: {str(e)}")

@app.post("/api/chat/save", dependencies=[Depends(authenticate_token)])
async def save_chat(data: ChatSaveRequest):
    try:
        if not all([data.userQuery, data.botResponse, data.sessionId, data.positionId, data.username]):
            logger.warning("Missing required fields for chat save")
            raise HTTPException(status_code=400, detail="Missing required fields")
        result = db["promptHistory"].insert_one({
            "userQuery": data.userQuery,
            "botResponse": data.botResponse,
            "sessionId": data.sessionId,
            "positionId": data.positionId,
            "experience": data.experience,
            "username": data.username,
            "queryDate": datetime.now()
        })
        logger.debug(f"Chat saved for session {data.sessionId}, insertedId: {str(result.inserted_id)}")
        return {"message": "Chat saved", "insertedId": str(result.inserted_id)}
    except Exception as e:
        logger.error(f"Error saving chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving chat: {str(e)}")

@app.delete("/api/chat/delete", dependencies=[Depends(authenticate_token)])
async def delete_chat(data: dict):
    try:
        if not all([data.get("username"), data.get("query"), data.get("date")]):
            logger.warning("Missing required fields for chat delete")
            raise HTTPException(status_code=400, detail="Missing required fields")
        result = db["promptHistory"].delete_one({
            "username": data["username"],
            "userQuery": data["query"],
            "queryDate": datetime.fromisoformat(data["date"])
        })
        if result.deleted_count == 0:
            logger.warning(f"No chat found to delete for username: {data['username']}, query: {data['query']}")
            raise HTTPException(status_code=404, detail="Chat not found")
        logger.debug(f"Deleted chat for username: {data['username']}")
        return {"message": "Chat deleted"}
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting chat: {str(e)}")

@app.get("/api/policy/download/{collection_id}", dependencies=[Depends(authenticate_token)])
async def download_collection(collection_id: str):
    try:
        cursor = db[collection_id].find()
        data = []
        for doc in cursor:
            if '_id' in doc:
                del doc['_id']  # Remove _id for download
            data.append(doc)
        if not data:
            logger.warning(f"No data found in collection {collection_id}")
            raise HTTPException(status_code=404, detail="No data found in collection")
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as temp_file:
            json.dump(data, temp_file, indent=2)
            temp_file_path = temp_file.name
        logger.debug(f"Generated JSON file for {collection_id} at {temp_file_path}")
        return FileResponse(
            temp_file_path,
            media_type='application/json',
            filename=f"{collection_id}.json",
            headers={"Content-Disposition": f"attachment; filename={collection_id}.json"}
        )
    except Exception as e:
        logger.error(f"Error downloading collection {collection_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error downloading collection: {str(e)}")

@app.post("/api/policy/collection/{collection_id}/record", dependencies=[Depends(authenticate_token)])
async def create_record(collection_id: str, data: RecordData):
    try:
        if not data.data or not isinstance(data.data, dict):
            logger.warning(f"Invalid data format for creating record in {collection_id}")
            raise HTTPException(status_code=400, detail="Invalid data format")
        result = db[collection_id].insert_one(data.data)
        logger.debug(f"Created record in {collection_id}, insertedId: {str(result.inserted_id)}")
        return {"message": "Record created successfully", "insertedId": str(result.inserted_id), "restart_required": True}
    except Exception as e:
        logger.error(f"Error creating record in {collection_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating record: {str(e)}")

@app.put("/api/policy/collection/{collection_id}/{record_id}", dependencies=[Depends(authenticate_token)])
async def update_record(collection_id: str, record_id: str, data: RecordData):
    try:
        result = db[collection_id].update_one(
            {"_id": ObjectId(record_id)},
            {"$set": data.data}
        )
        if result.matched_count == 0:
            logger.warning(f"No record found to update in {collection_id} with id: {record_id}")
            raise HTTPException(status_code=404, detail="Record not found")
        logger.debug(f"Updated record {record_id} in {collection_id}")
        return {"message": "Record updated successfully", "restart_required": True}
    except Exception as e:
        logger.error(f"Error updating record in {collection_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating record: {str(e)}")

@app.delete("/api/policy/collection/{collection_id}/{record_id}", dependencies=[Depends(authenticate_token)])
async def delete_record(collection_id: str, record_id: str):
    try:
        result = db[collection_id].delete_one(
            {"_id": ObjectId(record_id)}
        )
        if result.deleted_count == 0:
            logger.warning(f"No record found to delete in {collection_id} with id: {record_id}")
            raise HTTPException(status_code=404, detail="Record not found")
        logger.debug(f"Deleted record {record_id} from {collection_id}")
        return {"message": "Record deleted successfully", "restart_required": True}
    except Exception as e:
        logger.error(f"Error deleting record from {collection_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting record: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

def cleanup_sessions():
    now = datetime.now()
    expired = [sid for sid, session in active_sessions.items()
               if (now - session["created_at"]).total_seconds() > 1800]
    for sid in expired:
        active_sessions.pop(sid, None)
        logger.debug(f"Cleaned up session: {sid}")

@app.post("/chat")
async def initialize_chat(data: InitChatRequest):
    cleanup_sessions()
    normalized_position_id = data.position_id
    if data.position_id.startswith("EMP"):
        normalized_position_id = data.position_id.replace("EMP", "").lstrip("0").zfill(2)
    if normalized_position_id not in policy_chunks:
        logger.warning(f"No policies found for PositionId: {normalized_position_id}")
        vectorstore = None
    else:
        try:
            logger.info(f"Loading FAISS index for PositionId: {normalized_position_id}, Experience: {data.experience}")
            vectorstore = load_faiss_index(normalized_position_id, data.experience)
            logger.debug(f"Memory usage after loading FAISS index: {psutil.Process().memory_info().rss / 1024**2:.2f} MB")
        except Exception as e:
            logger.error(f"Failed to load FAISS index for {normalized_position_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to load policies: {str(e)}")

    try:
        logger.info(f"Creating QA chain for PositionId: {normalized_position_id}")
        qa_function = create_qa_chain(vectorstore, MODEL_PATH, normalized_position_id, all_policy_types, data.username)
        if not qa_function:
            raise ValueError("Failed to create QA chain")
        active_sessions[data.session_id] = {
            "qa_function": qa_function,
            "username": data.username,
            "position_id": normalized_position_id,
            "original_position_id": data.position_id,
            "experience": data.experience,
            "created_at": datetime.now()
        }
        logger.info(f"Initialized session {data.session_id} for PositionId {normalized_position_id}")
        return {
            "answer": f"Policy assistant initialized for {data.username} (Position ID: {normalized_position_id})",
            "session_id": data.session_id
        }
    except Exception as e:
        logger.error(f"Initialization failed for {data.position_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Initialization failed: {str(e)}")

@app.post("/ask")
async def ask_question(data: ChatRequest):
    cleanup_sessions()
    session = active_sessions.get(data.session_id)
    if not session:
        logger.warning(f"Invalid session_id: {data.session_id}")
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    try:
        logger.info(f"Processing question for session {data.session_id}: {data.question}")
        hr_keywords = ["health", "insurance", "policy", "coverage", "vacation", "leave", "benefits", "maternity", "dental", "vision", "emergency", "mental health"]
        is_hr_related = any(keyword in data.question.lower() for keyword in hr_keywords)

        if not is_hr_related:
            answer = "I'm here to assist you with HR-related inquiries. This question is outside the scope of my capabilities as a PolicyBot."
            store_conversation(
                username=session["username"],
                position_id=session["original_position_id"],
                question=data.question,
                answer=answer,
                session_id=data.session_id,
                experience=session["experience"]
            )
            return {"answer": answer, "related_questions": []}

        answer, related = session["qa_function"](data.question)
        store_conversation(
            username=session["username"],
            position_id=session["original_position_id"],
            question=data.question,
            answer=answer,
            session_id=data.session_id,
            experience=session["experience"]
        )
        logger.info(f"Processed question for session {data.session_id}")
        return {"answer": answer, "related_questions": related}
    except Exception as e:
        logger.error(f"QA error for session {data.session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

def store_conversation(username: str, position_id: str, question: str, answer: str, session_id: str, experience: str):
    try:
        prompt_history.insert_one({
            "userQuery": question,
            "botResponse": answer,
            "sessionId": session_id,
            "positionId": position_id,
            "experience": experience,
            "username": username,
            "queryDate": datetime.now()
        })
        logger.debug(f"Logged conversation for session {session_id}")
    except Exception as e:
        logger.error(f"Failed to log conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error logging conversation: {str(e)}")

if __name__ == "__main__":
    check_port()
    logger.info("Starting uvicorn server...")
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug", timeout_keep_alive=60, workers=1)
    except Exception as e:
        logger.error(f"Uvicorn server failed: {e}")
        raise
    finally:
        mongo_client.close()