#!/bin/bash
# PixelFree Backend API Query Tests (Authenticated)
#
# Requires:
#   1. Backend server running locally (default: http://localhost:3000).
#   2. A valid authentication session with Pixelfed.
#
# How to Authenticate:
#   - In a browser, visit: http://localhost:3000/api/auth
#   - Log in to your Pixelfed account and authorize PixelFree.
#   - The backend will store the authentication token in `.token.json`.
#   - Once this is complete, you can run this script without errors.
#
# Run from:
#   backend/scripts/
#
# Usage:
#   ./api_query_tests_authenticated.sh
#
# Notes:
#   - This script sends queries to the local backend and formats results with jq.
#   - Ensure jq is installed


# 0) Helper: base URL & pretty-print
BASE=http://localhost:3000
JQ='jq .'

########################################################
# TAGS-ONLY
########################################################

# 1) Tags ANY (default): find posts with ANY of the tags  [OR]
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"tag","tags":["Italy","France"],"limit":20}' | $JQ

# 2) Tags ALL: find posts that include ALL specified tags  [AND across tags]
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"tag","tags":["italy","travel"],"tagmode":"all","limit":20}' | $JQ

# 3) Tag normalization: with # and mixed case (should normalize)
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"tag","tags":["#Italy","france","#RetroComputing"],"limit":20}' | $JQ

########################################################
# USERS-ONLY
########################################################

# 4) Users ANY (OR across users): accts only
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"user","accts":["rivercityrandom@bitbang.social","@icm@mastodon.sdf.org"],"limit":20}' | $JQ

# 5) Users (mix accountIds + accts): server should resolve accts and de-dupe
# The account id  below (492024277268145458) was a valid account when these tests
# were written. Replace it with a valid ID should this account become inactive.
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"user","accountIds":["492024277268145458"],"accts":["@icm@mastodon.sdf.org"],"limit":20}' | $JQ

########################################################
# COMPOUND (USERS + TAGS)
########################################################

# 6) Compound ANY: ANY of the tags from ANY of the users  [OR AND OR]
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"compound","tags":["retrocomputing","retrocomputers"],"users":{"accts":["@rivercityrandom@bitbang.social","@icm@mastodon.sdf.org"]},"limit":20}' | $JQ

# 7) Compound ALL: ALL tags must be present, from ANY of the users  [AND across tags, OR across users]
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"compound","tags":["retrocomputing","classicmac"],"users":{"accts":["@bitsplusatoms@mastodon.social","@icm@mastodon.sdf.org"]},"tagmode":"all","limit":20}' | $JQ

########################################################
# PARTIAL ERRORS & VALIDATION
########################################################

# 8) Partial error: one invalid acct + one valid acct
# Expect JSON object with { photos: [...], errors: [...] }
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"user","accts":["@def-not-a-real-user@nope.example","@icm@mastodon.sdf.org"],"limit":10}' | $JQ

# 9) Validation: type=tag but no tags -> should be 400 with a clear message
curl -s -i "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"tag","tags":[],"limit":10}'

# 10) Validation: type=compound but neither tags nor users -> 400
curl -s -i "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"compound","tags":[],"users":{"accts":[]},"limit":10}'

########################################################
# LIMIT & CLAMPING
########################################################

# 11) Limit clamping: request >40 and check that result length <= 40
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"tag","tags":["retrocomputing"],"limit":100}' | jq 'length'

# 12) Small limit sanity check
curl -s "$BASE/api/photos/query" \
  -H 'Content-Type: application/json' \
  -d '{"type":"compound","tags":["retrocomputing"],"users":{"accts":["@bitsplusatoms@mastodon.social"]},"limit":3}' | jq 'length'
