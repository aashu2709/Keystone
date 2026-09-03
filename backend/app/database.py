"""
MongoDB Database Connection
This file handles connecting to MongoDB.

MongoDB Concepts for Beginners:
- Database: Like a folder containing collections
- Collection: Like a table in SQL (stores documents)
- Document: Like a row in SQL (JSON-like object)

Updated: Added token_blacklist collection for logout security
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from app.config import settings


# Global variables to store database connection
# We'll initialize these when the app starts
mongodb_client: AsyncIOMotorClient = None
database = None


async def connect_to_mongodb():
    """
    Connect to MongoDB when the application starts.

    This is called once when FastAPI starts up.
    We use 'motor' which is an async MongoDB driver.
    """
    global mongodb_client, database

    try:
        # Create the MongoDB client
        mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
        
        # Get the database (creates it if it doesn't exist)
        database = mongodb_client[settings.MONGODB_DB_NAME]
        
        # Test the connection
        await mongodb_client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {settings.MONGODB_DB_NAME}")
        
        # Create indexes for better performance
        await create_indexes()
        
    except ConnectionFailure as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        raise


async def close_mongodb_connection():
    """
    Close MongoDB connection when the application shuts down.
    """
    global mongodb_client

    if mongodb_client:
        mongodb_client.close()
        print("📴 MongoDB connection closed")


async def create_indexes():
    """
    Create database indexes for faster queries.

    Think of indexes like a book's index - 
    they help MongoDB find documents faster.
    """
    global database

    # Users collection indexes
    await database.users.create_index("id", unique=True)
    await database.users.create_index("username", unique=True)
    await database.users.create_index("email", unique=True)

    # VMs collection indexes
    await database.vms.create_index("id", unique=True)
    await database.vms.create_index("ip_address", unique=True)

    # User-VM mappings indexes
    await database.user_vm_mappings.create_index("id", unique=True)
    await database.user_vm_mappings.create_index(
        [("user_id", 1), ("vm_id", 1)], 
        unique=True
    )

    # Password history indexes
    await database.password_history.create_index(
        [("vm_id", 1), ("local_username", 1), ("created_at", -1)]
    )

    # Audit logs indexes
    await database.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
    await database.audit_logs.create_index([("timestamp", -1)])

    # Notifications indexes
    await database.notifications.create_index(
        [("user_id", 1), ("is_read", 1), ("created_at", -1)]
    )

    # ===========================================
    # TOKEN BLACKLIST INDEXES (NEW!)
    # ===========================================
    # Index on token for fast lookups
    await database.token_blacklist.create_index("token", unique=True)

    # TTL index to auto-delete expired tokens after 24 hours
    # MongoDB will automatically remove documents when expires_at passes
    await database.token_blacklist.create_index(
        "expires_at",
        expireAfterSeconds=0  # Delete immediately when expires_at is reached
    )

    # Index on user_id for finding all tokens for a user
    await database.token_blacklist.create_index("user_id")

    # ===========================================
    # TELEMETRY INDEXES (Raw 30s data)
    # ===========================================
    # Compound index for fast timeline queries per VM
    await database.telemetry.create_index([("vm_id", 1), ("timestamp", 1)])

    # The old code had a TTL index (expireAfterSeconds=2592000) on "timestamp".
    # We now manage cleanup manually via the nightly downsampling job.
    # Drop the old TTL index if it exists, then create a plain index.
    try:
        await database.telemetry.drop_index("timestamp_1")
    except Exception:
        pass  # Index didn't exist — that's fine
    await database.telemetry.create_index("timestamp", name="timestamp_1")

    # ===========================================
    # TELEMETRY COMPRESSED INDEXES (5-min averages)
    # ===========================================
    # Compound index for fast history queries per VM
    await database.telemetry_compressed.create_index([("vm_id", 1), ("bucket_start", 1)])

    print("📇 Database indexes created")


def get_database():
    """
    Get the database instance.
    Use this in route handlers.
    """
    return database


# ===========================================
# HELPER FUNCTIONS TO GET COLLECTIONS
# ===========================================

def get_users_collection():
    return database.users


def get_vms_collection():
    return database.vms


def get_mappings_collection():
    return database.user_vm_mappings


def get_password_history_collection():
    return database.password_history


def get_audit_logs_collection():
    return database.audit_logs


def get_notifications_collection():
    return database.notifications


def get_token_blacklist_collection():
    """Get the token blacklist collection for logout security."""
    return database.token_blacklist


def get_telemetry_collection():
    """Get the performance telemetry history collection."""
    return database.telemetry