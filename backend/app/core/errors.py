from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = "bad_request") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def api_error_payload(message: str, code: str, correlation_id: str) -> dict:
    return {
        "success": False,
        "error": message,
        "error_contract": {
            "code": code,
            "message": message,
            "correlation_id": correlation_id,
        },
    }


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    return JSONResponse(
        status_code=exc.status_code,
        content=api_error_payload(exc.message, exc.code, correlation_id),
    )
