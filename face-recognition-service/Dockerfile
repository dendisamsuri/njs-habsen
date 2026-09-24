FROM python:3.11-slim

ARG OPENCV_ZOO_REVISION=47534e27c9851bb1128ccc0102f1145e27f23f98
ARG OPENCV_ZOO_RAW=https://media.githubusercontent.com/media/opencv/opencv_zoo
ARG OPENCV_ZOO_SOURCE=https://raw.githubusercontent.com/opencv/opencv_zoo

RUN apt-get update && apt-get install -y --no-install-recommends curl libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/models \
    && curl --fail --location --retry 3 "$OPENCV_ZOO_RAW/$OPENCV_ZOO_REVISION/models/face_detection_yunet/face_detection_yunet_2023mar.onnx" -o /app/models/face_detection_yunet_2023mar.onnx \
    && curl --fail --location --retry 3 "$OPENCV_ZOO_SOURCE/$OPENCV_ZOO_REVISION/models/face_detection_yunet/LICENSE" -o /app/models/YUNET_LICENSE \
    && curl --fail --location --retry 3 "$OPENCV_ZOO_RAW/$OPENCV_ZOO_REVISION/models/face_recognition_sface/face_recognition_sface_2021dec.onnx" -o /app/models/face_recognition_sface_2021dec.onnx \
    && curl --fail --location --retry 3 "$OPENCV_ZOO_SOURCE/$OPENCV_ZOO_REVISION/models/face_recognition_sface/LICENSE" -o /app/models/SFACE_LICENSE

COPY app.py image_metadata.py ./

USER 65534:65534
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "1", "--timeout", "9", "--graceful-timeout", "5", "--max-requests", "500", "--max-requests-jitter", "50", "app:app"]
