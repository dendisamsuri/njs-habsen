import struct
import unittest

from image_metadata import image_dimensions


class ImageMetadataTest(unittest.TestCase):
    def test_png_dimensions(self):
        data = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 640, 480)
        self.assertEqual((640, 480), image_dimensions(data))

    def test_rejects_fake_png_header(self):
        with self.assertRaises(ValueError):
            image_dimensions(b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 12) + b"IHDR" + b"\0" * 8)

    def test_jpeg_dimensions_with_unknown_segment(self):
        app_segment = b"\xff\xe2" + struct.pack(">H", 4) + b"ab"
        sof = b"\xff\xc0" + struct.pack(">H", 7) + b"\x08" + struct.pack(">HH", 480, 640)
        self.assertEqual((640, 480), image_dimensions(b"\xff\xd8" + app_segment + sof))

    def test_rejects_truncated_jpeg(self):
        with self.assertRaises(ValueError):
            image_dimensions(b"\xff\xd8\xff\xe0\x00\x10ab")

    def test_returns_extreme_dimensions_for_caller_validation(self):
        sof = b"\xff\xc0" + struct.pack(">H", 7) + b"\x08" + struct.pack(">HH", 65535, 65535)
        self.assertEqual((65535, 65535), image_dimensions(b"\xff\xd8" + sof))


if __name__ == "__main__":
    unittest.main()
