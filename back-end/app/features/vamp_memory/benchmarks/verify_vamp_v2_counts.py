import asyncio
from app.features.conversations.infrastructure.firestore_service import FirestoreService, get_firestore_db
from app.features.vamp_memory.infrastructure.summary_block_repository import SummaryBlockRepository
from app.features.conversations.infrastructure.conversation_repository import ConversationRepository
from app.features.vamp_memory.application.vamp_memory_service import get_default_vector_store

async def verify():
    FirestoreService.initialize()
    db = get_firestore_db()
    conv_id = "vamp-hard-bullets-only-001"
    user_id = "test-user-vamp"
    
    conv_ref = db.collection(ConversationRepository.COLLECTION_NAME).document(conv_id)
    summary_blocks_ref = conv_ref.collection(SummaryBlockRepository.SUMMARY_COLLECTION)
    summary_docs = summary_blocks_ref.get()
    
    summary_count = len(summary_docs)
    bullet_count = sum(len(doc.to_dict().get("memory_bullets", [])) for doc in summary_docs)
    
    print(f"summary block count: {summary_count}")
    print(f"total memory bullet count: {bullet_count}")
    
    vector_store = get_default_vector_store()
    
    # Query summary_block pointers
    summary_hits = await vector_store.search(
        conversation_id=conv_id,
        query_vector=[0.0]*1024,
        k=10000,
        pointer_type="summary_block"
    )
    print(f"Qdrant summary_block pointer count: {len(summary_hits)}")
    
    # Query memory_bullet pointers
    bullet_hits = await vector_store.search(
        conversation_id=conv_id,
        query_vector=[0.0]*1024,
        k=10000,
        pointer_type="memory_bullet"
    )
    print(f"Qdrant memory_bullet pointer count: {len(bullet_hits)}")

if __name__ == "__main__":
    asyncio.run(verify())
