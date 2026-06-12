#!/bin/bash
set -e
git add -A
git commit -m "content update $(date +%Y-%m-%d)"
git push
