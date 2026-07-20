# backend/chatbot.py
import os
import json
from typing import List, Tuple, Set
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import PromptTemplate
from langchain_community.llms import LlamaCpp
from loguru import logger
from dotenv import load_dotenv
from pymongo import MongoClient
from collections import OrderedDict
import hashlib
import psutil

load_dotenv()
logger.add("chatbot.log", level="DEBUG", rotation="10 MB", retention="5 days")

EMBEDDING_MODEL = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L12-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"batch_size": 8, "normalize_embeddings": True}
)

FAQ_CACHE = OrderedDict()
MAX_CACHE_SIZE = 1000

mongo_client = MongoClient("mongodb://localhost:27017")
db = mongo_client["policyDB"]
users_collection = db["users"]

def log_memory_usage():
    mem_info = psutil.Process().memory_info()
    logger.debug(f"Memory usage: {mem_info.rss / 1024**2:.2f} MB")

def authenticate_user(username: str, password: str) -> dict:
    try:
        logger.info(f"Authenticating user: {username}")
        user = users_collection.find_one({"username": username, "password": password})
        if not user:
            logger.warning(f"Authentication failed for {username}")
            return None
        return {
            "username": user["username"],
            "position_id": user["positionId"],
            "experience": user.get("experience", "N/A")
        }
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return None

def load_policy_cache() -> Tuple[dict, Set[str]]:
    try:
        logger.info("Loading policy cache from MongoDB collections")
        policy_chunks = {}
        all_policy_types = set()
        collections = db.list_collection_names()
        collection_names = [col for col in collections
                            if col not in ['users', 'promptHistory', 'forgotRequests']]
        logger.debug(f"Found collections: {collection_names}")
        for col_name in collection_names:
            collection = db[col_name]
            policies = collection.find({"status": "Active"})
            policy_type = col_name.replace('_policies', '').replace('_', ' ').title()
            all_policy_types.add(policy_type)
            for policy_doc in policies:
                policy = policy_doc.copy()
                policy.pop('_id', None)
                policy["type"] = policy_type
                position_ids = policy.get("positionId", ["ADMIN001", "01"])
                if isinstance(position_ids, str):
                    position_ids = [position_ids]
                for pos_id in position_ids:
                    normalized_pos_id = pos_id
                    if pos_id.startswith("EMP"):
                        normalized_pos_id = pos_id.replace("EMP", "").lstrip("0").zfill(2)
                    if normalized_pos_id not in policy_chunks:
                        policy_chunks[normalized_pos_id] = []
                    policy_chunks[normalized_pos_id].append(policy)
        logger.info(f"Loaded policy cache with {len(policy_chunks)} PositionIds: {list(policy_chunks.keys())}")
        return policy_chunks, all_policy_types
    except Exception as e:
        logger.error(f"Failed to load policy cache: {e}")
        return {}, set()

def load_faiss_index(position_id: str, experience: str = "N/A") -> FAISS:
    try:
        policy_chunks, _ = load_policy_cache()
        if not policy_chunks:
            logger.warning("No policies found in cache. Returning empty FAISS index.")
            return FAISS.from_documents([], EMBEDDING_MODEL)
        if position_id not in policy_chunks:
            logger.warning(f"No policies for PositionId {position_id}")
            return FAISS.from_documents([], EMBEDDING_MODEL)
        policies = policy_chunks[position_id]
        filtered_policies = []
        for policy in policies:
            exp_range = policy.get("ExperienceRange")
            if not exp_range or experience == "N/A":
                filtered_policies.append(policy)
                continue
            try:
                if '-' in exp_range:
                    min_exp, max_exp = map(float, exp_range.split('-'))
                    user_exp = float(experience) if experience.replace('.', '').isdigit() else 0.0
                    if min_exp <= user_exp <= max_exp:
                        filtered_policies.append(policy)
                elif exp_range == experience:
                    filtered_policies.append(policy)
            except ValueError:
                logger.warning(f"Invalid ExperienceRange: {exp_range}")
        if not filtered_policies:
            logger.warning(f"No policies available for PositionId {position_id} and experience {experience}")
            return FAISS.from_documents([], EMBEDDING_MODEL)
        from langchain_core.documents import Document
        documents = [Document(page_content=json.dumps(policy), metadata={"type": policy["type"]})
                     for policy in filtered_policies]
        logger.debug(f"Creating FAISS index with {len(documents)} documents for PositionId {position_id}")
        vectorstore = FAISS.from_documents(documents, EMBEDDING_MODEL)
        logger.info(f"Created FAISS index for PositionId {position_id}")
        return vectorstore
    except Exception as e:
        logger.error(f"Failed to load FAISS index: {e}")
        raise

def generate_related_questions(question: str, context: str) -> List[str]:
    related_questions = set()
    lower = f"{question.lower()} {context.lower()}"
    if "drug" in lower:
        related_questions.update([
            "What are the consequences of violating the Anti-Drug Policy?",
            "What support is available for employees with drug-related issues?"
        ])
    if "harassment" in lower:
        related_questions.update([
            "What is the process for reporting harassment?",
            "What are the consequences of violating the Anti-Harassment Policy?"
        ])
    if "leave" in lower or "vacation" in lower:
        related_questions.update([
            "How many vacation days can be carried over?",
            "What is the process for requesting leave?"
        ])
    return list(related_questions)[:2]

def preprocess_query(question: str) -> str:
    question = question.strip().lower()
    if question in ["what will it show", "what does it show", "show me"]:
        return "describe the company policies applicable to my role"
    return question

def create_qa_chain(vectorstore: FAISS, model_path: str, position_id: str, all_policy_types: Set[str], username: str) -> callable:
    try:
        logger.info(f"Creating QA chain for PositionId: {position_id}, Model: {model_path}")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model path {model_path} does not exist")
        llm = LlamaCpp(
            model_path=model_path,
            n_ctx=2048,
            n_batch=128,
            temperature=0.3,
            max_tokens=512,
            n_threads=4,
            n_gpu_layers=0,
            verbose=False
        )
        prompt_template = PromptTemplate(
            input_variables=["context", "question", "username", "position_id"],
            template="""You are PolicyBot, assisting {username} (PositionId: {position_id}).
Context: {context}
Question: {question}
Answer:"""
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3}) if vectorstore else None

        def qa_function(question: str) -> Tuple[str, List[str]]:
            try:
                processed_query = preprocess_query(question)
                question_hash = hashlib.sha256(processed_query.encode()).hexdigest()

                if len(FAQ_CACHE) >= MAX_CACHE_SIZE:
                    FAQ_CACHE.popitem(last=False)

                if question_hash in FAQ_CACHE:
                    logger.debug(f"Cache hit for question: {processed_query}")
                    return FAQ_CACHE[question_hash]["answer"], FAQ_CACHE[question_hash]["related_questions"]

                if not retriever:
                    answer = f"No policies available for {username} (PositionId: {position_id}). Please contact HR."
                    related_questions = generate_related_questions(processed_query, "")
                    FAQ_CACHE[question_hash] = {"answer": answer, "related_questions": related_questions}
                    return answer, related_questions

                docs_with_scores = vectorstore.similarity_search_with_score(query=processed_query, k=3)
                docs = [doc for doc, _ in docs_with_scores]
                if not docs or max(score for _, score in docs_with_scores) < 0.3:
                    answer = f"No specific policy matches your query, {username}. Please rephrase or contact HR."
                    related_questions = generate_related_questions(processed_query, "")
                    FAQ_CACHE[question_hash] = {"answer": answer, "related_questions": related_questions}
                    return answer, related_questions

                context = "\n".join([doc.page_content for doc in docs])
                prompt = prompt_template.format(context=context, question=processed_query, username=username, position_id=position_id)
                answer = llm.invoke(prompt).strip() or f"No specific policy matches your query, {username}."
                related_questions = generate_related_questions(processed_query, context)
                FAQ_CACHE[question_hash] = {"answer": answer, "related_questions": related_questions}
                logger.info(f"Generated response for {username} (PositionId: {position_id})")
                return answer, related_questions
            except Exception as e:
                logger.error(f"Query processing failed: {e}")
                return f"Error processing query: {e}", []

        return qa_function
    except Exception as e:
        logger.error(f"Failed to create QA chain: {e}")
        return None

def main():
    model_path = os.getenv("MODEL_PATH", r"D:\1FYP\bot version\Latest Bot 30-may-2025\ChatBot using Langchain\models\Phi-3-mini-4k-instruct-v0.3-Q4_K_M.gguf")
    logger.info(f"Starting chatbot with MODEL_PATH: {model_path}")
    if not os.path.exists(model_path):
        logger.error(f"Model file {model_path} not found")
        return
    try:
        logger.debug(f"Memory usage before loading policy cache: {psutil.Process().memory_info().rss / 1024**2:.2f} MB")
        _, all_policy_types = load_policy_cache()
        logger.debug(f"Memory usage after loading policy cache: {psutil.Process().memory_info().rss / 1024**2:.2f} MB")
    except Exception as e:
        logger.error(f"Failed to load policy cache: {e}")
        return
    username = input("Enter username: ").strip()
    password = input("Enter password: ").strip()
    user_data = authenticate_user(username, password)
    if not user_data:
        print("Authentication failed")
        return
    position_id = user_data["position_id"]
    print(f"Welcome, {username}! Position ID: {position_id}")
    try:
        vectorstore = load_faiss_index(position_id, user_data["experience"])
        qa_chain = create_qa_chain(vectorstore, model_path, position_id, all_policy_types, username)
        if not qa_chain:
            print("System initialization failed")
            return
        print("Chatbot ready! Ask your questions.")
        while True:
            question = input("Enter your question (or 'quit' to exit): ").strip()
            if question.lower() == "quit":
                break
            answer, related_questions = qa_chain(question)
            print(f"Answer: {answer}\n")
            if related_questions:
                print("Related questions:")
                for i, q in enumerate(related_questions, 1):
                    print(f"{i}. {q}")
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        print("An error occurred. Please try again or contact support.")
    finally:
        mongo_client.close()

if __name__ == "__main__":
    main()