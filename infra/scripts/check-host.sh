#!/usr/bin/env sh
set -eu

docker version
docker compose version
docker compose config --quiet
docker compose ps
df -h
free -h
