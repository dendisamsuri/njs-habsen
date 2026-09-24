import struct


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SOF_MARKERS = {
    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
    0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
}


def image_dimensions(data):
    if data.startswith(PNG_SIGNATURE):
        if len(data) < 24 or data[12:16] != b"IHDR":
            raise ValueError("Format PNG tidak valid")
        if struct.unpack(">I", data[8:12])[0] != 13:
            raise ValueError("Format PNG tidak valid")
        return struct.unpack(">II", data[16:24])

    if not data.startswith(b"\xff\xd8"):
        raise ValueError("Format gambar harus JPEG atau PNG")

    offset = 2
    marker_count = 0
    while offset < len(data) and marker_count < 256:
        if data[offset] != 0xFF:
            raise ValueError("Format JPEG tidak valid")
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            break
        marker = data[offset]
        offset += 1
        marker_count += 1
        if marker == 0xD9 or marker == 0xDA:
            break
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(data):
            break
        segment_length = struct.unpack(">H", data[offset:offset + 2])[0]
        if segment_length < 2 or offset + segment_length > len(data):
            raise ValueError("Format JPEG tidak valid")
        if marker in JPEG_SOF_MARKERS:
            if segment_length < 7:
                raise ValueError("Format JPEG tidak valid")
            height, width = struct.unpack(">HH", data[offset + 3:offset + 7])
            return width, height
        offset += segment_length
    raise ValueError("Metadata dimensi JPEG tidak ditemukan")
