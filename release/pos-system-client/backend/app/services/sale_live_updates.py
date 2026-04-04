import asyncio
import json
import threading
from collections import defaultdict
from datetime import datetime

from fastapi.responses import StreamingResponse

_subscribers_by_table: dict[int, set[asyncio.Queue]] = defaultdict(set)
_subscriber_lock = threading.Lock()
_stream_loop: asyncio.AbstractEventLoop | None = None


def _build_event_payload(table_id: int, event_type: str):
    return {
        "type": event_type,
        "table_id": int(table_id),
        "emitted_at": datetime.utcnow().isoformat() + "Z",
    }


def _format_sse_message(payload: dict):
    return f"data: {json.dumps(payload)}\n\n"


def _enqueue_event(queue: asyncio.Queue, payload: dict):
    try:
        while queue.qsize() >= 5:
            queue.get_nowait()
    except asyncio.QueueEmpty:
        pass

    try:
        queue.put_nowait(payload)
    except asyncio.QueueFull:
        pass


async def stream_table_sale_events(table_id: int):
    global _stream_loop

    queue: asyncio.Queue = asyncio.Queue(maxsize=5)
    _stream_loop = asyncio.get_running_loop()

    with _subscriber_lock:
        _subscribers_by_table[int(table_id)].add(queue)

    async def event_generator():
        yield _format_sse_message(_build_event_payload(table_id, "connected"))

        try:
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue

                yield _format_sse_message(payload)
        finally:
            with _subscriber_lock:
                table_subscribers = _subscribers_by_table.get(int(table_id))

                if table_subscribers is not None:
                    table_subscribers.discard(queue)

                    if not table_subscribers:
                        _subscribers_by_table.pop(int(table_id), None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def publish_table_sale_event(table_id: int, event_type: str = "updated"):
    global _stream_loop

    if table_id is None or _stream_loop is None:
        return

    with _subscriber_lock:
        subscribers = list(_subscribers_by_table.get(int(table_id), set()))

    if not subscribers:
        return

    payload = _build_event_payload(table_id, event_type)

    for queue in subscribers:
        _stream_loop.call_soon_threadsafe(_enqueue_event, queue, payload)


def publish_table_sale_events(table_ids, event_type: str = "updated"):
    seen_table_ids = set()

    for table_id in table_ids or []:
        if table_id in seen_table_ids or table_id is None:
            continue

        seen_table_ids.add(table_id)
        publish_table_sale_event(table_id, event_type)
