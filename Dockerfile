# The latest version that can work WITHOUT AVX
FROM mongo:4.4.18

COPY mongo-init.sh /docker-entrypoint-initdb.d/