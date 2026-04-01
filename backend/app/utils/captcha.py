"""
CAPTCHA Utility
Generates SVG-based Math CAPTCHAs and validates answers using encrypted tokens.
"""

import random
import json
import base64
from datetime import datetime, timedelta
from fastapi import HTTPException, status

from app.utils.security import encrypt_string, decrypt_string

def generate_math_captcha() -> dict:
    """
    Generates a math problem, an SVG image of it, and an encrypted token containing the answer.
    """
    operators = ['+', '-']
    operator = random.choice(operators)
    
    if operator == '+':
        num1 = random.randint(1, 49)
        num2 = random.randint(1, 49)
        answer = num1 + num2
    else:
        # Guarantee a positive result
        num1 = random.randint(10, 50)
        num2 = random.randint(1, num1 - 1)
        answer = num1 - num2
        
    problem_text = f"{num1} {operator} {num2} = ?"
    
    # Generate SVG with some basic noise/rotation to prevent simple OCR
    # Randomly rotate text slightly
    rotation = random.randint(-4, 4)
    
    # Generate random noise lines
    noise_lines = ""
    for _ in range(3):
        x1 = random.randint(0, 50)
        y1 = random.randint(0, 50)
        x2 = random.randint(100, 150)
        y2 = random.randint(0, 50)
        color = random.choice(["#cbd5e1", "#94a3b8", "#e2e8f0"])
        noise_lines += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="2" opacity="0.6"/>'
        
    svg_content = f"""<svg width="150" height="50" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#f8fafc" rx="4"/>
{noise_lines}
<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="monospace, sans-serif" font-size="22" font-weight="bold" fill="#334155" letter-spacing="2" transform="rotate({rotation} 75 25)">{problem_text}</text>
</svg>"""

    # Base64 encode the SVG for easy frontend display
    svg_b64 = base64.b64encode(svg_content.encode('utf-8')).decode('utf-8')
    image_data_uri = f"data:image/svg+xml;base64,{svg_b64}"
    
    # Create token payload with an expiry time (e.g., 5 minutes from now)
    expires_at = int((datetime.now() + timedelta(minutes=5)).timestamp())
    payload = {
        "answer": str(answer),
        "exp": expires_at
    }
    
    # Encrypt the payload into a token
    encrypted_token = encrypt_string(json.dumps(payload))
    
    return {
        "image_data": image_data_uri,
        "captcha_token": encrypted_token,
        "token_expires_in": 300 # seconds
    }

def verify_captcha(token: str, user_answer: str) -> bool:
    """
    Verifies that the provided CAPTCHA answer is correct and the token isn't expired.
    Raises HTTPException if invalid.
    """
    if not token or not user_answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification is required"
        )
        
    try:
        decrypted_json = decrypt_string(token)
        payload = json.loads(decrypted_json)
        
        expected_answer = payload.get("answer")
        expires_at = payload.get("exp", 0)
        
        # Check expiry
        if int(datetime.now().timestamp()) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CAPTCHA has expired. Please refresh."
            )
            
        # Check answer
        if str(user_answer).strip() != expected_answer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect CAPTCHA answer"
            )
            
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        # Catch decryption errors or malformed json
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid CAPTCHA token"
        )
