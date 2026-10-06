#!/bin/sh
# Records the site's videos in a container, the same way locally and in CI.
#   D2LIVE_SRC=../d2-live ./record.sh [scene ...]
set -eu
cd "$(dirname "$0")"
src=${D2LIVE_SRC:?set D2LIVE_SRC to a d2-live checkout}

case $(docker info --format '{{.Architecture}}') in
  aarch64 | arm64) arch=arm64 ;;
  *) arch=amd64 ;;
esac
mkdir -p .bin videos
(cd "$src" && CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -o "$OLDPWD/.bin/d2-live" .)

docker build -q -t d2-live-site-rec -f record/Dockerfile . >/dev/null
docker run --rm --init --shm-size=1g \
  -v "$PWD:/work" \
  -e ROOT=/work -e D2LIVE=/work/.bin/d2-live -e OUT=/work/videos \
  d2-live-site-rec sh -c 'cp /work/record/*.mjs /rec/ && node /rec/record.mjs "$@"' -- "$@"
