"""Vercel Python entry point; reuse the reviewed bounded PDF transport unchanged."""
import importlib.util
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('oaz_pdf_transport', ROOT / 'scripts/public-pdf-service.py')
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)
handler = transport.handler_class(os.environ.get('OAZ_PDF_VALIDATOR_KEY', ''))
