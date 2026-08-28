# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o haven-server ./cmd/server

# Final runtime stage
FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/haven-server /app/haven-server

RUN mkdir -p /data /data/uploads

ENV PORT=8080
ENV DB_PATH=/data/haven.db
ENV UPLOAD_DIR=/data/uploads

EXPOSE 8080

CMD ["/app/haven-server"]
