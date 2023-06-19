#!/bin/bash
echo 'Start #################################################################'

set -e

mongo <<EOF
use admin
db = db.getSiblingDB('$MONGO_INITDB_DATABASE');
db.createCollection('users')
db.createUser(
  {
    user: "$MONGO_INITDB_ROOT_USERNAME",
    pwd: "$MONGO_INITDB_ROOT_PASSWORD",
    roles: [{ role: 'readWrite', db: "$MONGO_INITDB_DATABASE" }],
  },
);
EOF

echo 'END #################################################################'