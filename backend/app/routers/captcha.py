from fastapi import APIRouter
from app.utils.captcha import generate_math_captcha

router = APIRouter(prefix="/captcha", tags=["CAPTCHA"])

@router.get("")
@router.get("/")
async def get_captcha():
    """
    Generate a new Math CAPTCHA.
    Returns a base64 encoded SVG image and an encrypted token containing the answer.
    """
    return generate_math_captcha()
