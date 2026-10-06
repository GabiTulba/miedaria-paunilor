FROM python:3.14.4-slim-trixie

# rsvg-convert turns the A4 sheets into PDFs.
RUN apt-get update && \
    apt-get install -y --no-install-recommends librsvg2-bin && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

COPY artwork/requirements.txt constraints.txt ./
RUN pip install --no-cache-dir --root-user-action=ignore -r requirements.txt -c constraints.txt

# Only what rendering needs from the artwork repository (see .dockerignore).
COPY artwork ./artwork
COPY content.py render.py server.py ./
RUN python -m compileall -q /app && useradd --system --no-create-home labels

USER labels
EXPOSE 8080
CMD ["python", "server.py"]
