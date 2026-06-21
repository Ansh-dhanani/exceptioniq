#!/bin/bash
set -e

python manage.py migrate --noinput

if [ "$RUN_SEED" = "true" ]; then
  python manage.py seed_db --noinput
fi

gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
