@echo off
chcp 65001 >nul
setlocal
set "PY=%~dp0..\..\Python314\python.exe"
"%PY%" -m pip install --no-input --no-cache-dir --disable-pip-version-check fastapi uvicorn pymupdf python-multipart httpx pydantic
echo EXITCODE=%ERRORLEVEL%
echo DONE
