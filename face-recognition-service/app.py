import os
import math
import base64

import cv2
import numpy as np
from flask import Flask, jsonify, request
from image_metadata import image_dimensions


def env_int(name, default, minimum, maximum):
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value < minimum or value > maximum:
        raise RuntimeError(f"{name} is outside the allowed range")
    return value


def env_float(name, default, minimum, maximum):
    raw = os.getenv(name, str(default))
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be numeric") from exc
    if not math.isfinite(value) or value < minimum or value > maximum:
        raise RuntimeError(f"{name} is outside the allowed range")
    return value


MAX_REQUEST_BYTES = env_int("MAX_REQUEST_BYTES", 12582912, 1024, 67108864)
MAX_IMAGE_WIDTH = env_int("MAX_IMAGE_WIDTH", 4096, 64, 16384)
MAX_IMAGE_HEIGHT = env_int("MAX_IMAGE_HEIGHT", 4096, 64, 16384)
MAX_IMAGE_PIXELS = env_int("MAX_IMAGE_PIXELS", 12000000, 4096, 50000000)
MAX_IMAGE_BYTES = env_int("MAX_IMAGE_BYTES", 5242880, 1024, MAX_REQUEST_BYTES)
MAX_INFERENCE_WIDTH = env_int("MAX_INFERENCE_WIDTH", 1280, 64, MAX_IMAGE_WIDTH)
MAX_INFERENCE_HEIGHT = env_int("MAX_INFERENCE_HEIGHT", 1280, 64, MAX_IMAGE_HEIGHT)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES

MODEL_DIR = os.getenv("MODEL_DIR", "/app/models")
COSINE_THRESHOLD = env_float("FACE_COSINE_THRESHOLD", 0.363, 0.0, 1.0)

detector = cv2.FaceDetectorYN.create(
    os.path.join(MODEL_DIR, "face_detection_yunet_2023mar.onnx"),
    "",
    (320, 320),
    0.9,
    0.3,
    5000,
)
recognizer = cv2.FaceRecognizerSF.create(
    os.path.join(MODEL_DIR, "face_recognition_sface_2021dec.onnx"), ""
)


def decode_image(encoded):
    if not isinstance(encoded, str) or not encoded:
        raise ValueError("Gambar tidak tersedia")

    if len(encoded) > ((MAX_IMAGE_BYTES + 2) // 3) * 4:
        raise ValueError("Ukuran gambar terlalu besar")

    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError):
        raise ValueError("Format gambar tidak valid")
    if len(decoded) > MAX_IMAGE_BYTES:
        raise ValueError("Ukuran gambar terlalu besar")

    width, height = image_dimensions(decoded)
    if (
        width <= 0
        or height <= 0
        or width > MAX_IMAGE_WIDTH
        or height > MAX_IMAGE_HEIGHT
        or width * height > MAX_IMAGE_PIXELS
    ):
        raise ValueError("Dimensi gambar terlalu besar")

    raw = np.frombuffer(decoded, np.uint8)
    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Gambar tidak dapat dibaca")
    height, width = image.shape[:2]
    if (
        width > MAX_IMAGE_WIDTH
        or height > MAX_IMAGE_HEIGHT
        or width * height > MAX_IMAGE_PIXELS
    ):
        raise ValueError("Dimensi gambar terlalu besar")
    return image


class FaceCountError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def extract_feature(image, label):
    height, width = image.shape[:2]
    scale = min(MAX_INFERENCE_WIDTH / width, MAX_INFERENCE_HEIGHT / height, 1.0)
    if scale < 1.0:
        image = cv2.resize(
            image,
            (max(1, int(width * scale)), max(1, int(height * scale))),
            interpolation=cv2.INTER_AREA,
        )
        height, width = image.shape[:2]
    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    count = 0 if faces is None else len(faces)
    if count == 0:
        raise FaceCountError(
            "FACE_NO_FACE_DETECTED",
            f"{label} tidak terdeteksi. Pastikan wajah jelas di kamera dan pencahayaan cukup.",
        )
    if count > 1:
        raise FaceCountError(
            "FACE_MULTIPLE_FACES",
            f"{label} tidak boleh lebih dari 1. Pastikan hanya satu wajah di frame.",
        )

    aligned = recognizer.alignCrop(image, faces[0])
    return recognizer.feature(aligned)


@app.get("/health")
def health():
    return jsonify({"status": "success"})


@app.post("/verify")
def verify():
    payload = request.get_json(silent=True) or {}
    try:
        master = extract_feature(decode_image(payload.get("master")), "Foto master")
        probe = extract_feature(decode_image(payload.get("probe")), "Foto absensi")
        similarity = float(
            recognizer.match(master, probe, cv2.FaceRecognizerSF_FR_COSINE)
        )
    except FaceCountError as exc:
        return jsonify({"status": "error", "error_code": exc.code, "message": str(exc)}), 400
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 422
    except cv2.error:
        return jsonify({"status": "error", "message": "Pemrosesan wajah gagal"}), 422

    return jsonify(
        {
            "status": "success",
            "matched": similarity >= COSINE_THRESHOLD,
            "similarity": round(similarity, 6),
            "threshold": COSINE_THRESHOLD,
        }
    )


@app.post("/validate")
def validate():
    payload = request.get_json(silent=True) or {}
    try:
        extract_feature(decode_image(payload.get("image")), "Foto master")
    except FaceCountError as exc:
        return jsonify({"status": "error", "error_code": exc.code, "message": str(exc)}), 400
    except ValueError as exc:
        return jsonify({"status": "error", "message": str(exc)}), 422
    except cv2.error:
        return jsonify({"status": "error", "message": "Pemrosesan wajah gagal"}), 422

    return jsonify({"status": "success", "valid": True})


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"status": "error", "message": "Ukuran gambar terlalu besar"}), 413
