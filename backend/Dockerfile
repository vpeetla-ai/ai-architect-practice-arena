FROM python:3.11-slim
WORKDIR /app
COPY backend/pyproject.toml ./backend/pyproject.toml
COPY backend/src ./backend/src
COPY content/rubrics.json ./content/rubrics.json
RUN pip install --no-cache-dir -e ./backend
ENV PYTHONPATH=/app/backend/src
EXPOSE 8000
CMD ["uvicorn", "practice_arena.main:app", "--host", "0.0.0.0", "--port", "8000"]
