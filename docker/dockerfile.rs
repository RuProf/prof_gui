FROM rust:1.85.1 AS build-env
WORKDIR /app
COPY backend/rust /app/
# ENV TARGET=<arch-OS>-musl
# aarch64-unknown-linux-musl, x86_64-unknown-linux-musl, etc.
RUN rustup target list | grep installed | head -n 1 | sed 's/-[^-]*$/-musl/; s/ (installed)//' > /targets
RUN rustup target add $(cat /targets)
RUN echo $(cat /targets)
RUN cargo build --release --locked --target $(cat /targets)
RUN mv /app/target/$(cat /targets)/release/prof_gui /app/restapi

FROM scratch AS runtime
WORKDIR /app
EXPOSE 8080
COPY ui/ /app/
COPY --from=build-env /app/restapi /server
CMD ["/server"]

# Build
# DOCKER_BUILDKIT=0 docker build -t prof_gui:rust -f docker/dockerfile.rs --progress=plain .
# docker build -t prof_gui:rust -f docker/dockerfile.rs .

# Dev
# docker run --name prof_gui --rm -d -v $PWD:/w -w /w -p 5000:8080 rust:1.85.1-slim
# docker run --name prof_gui --rm -d -p 5000:8080 --entrypoint sh prof_gui:rust

# Deploy
# docker run --rm -d --name prof_gui -v ./lprof_ext.json:/lprof_ext.json -p 5000:8080 prof_gui:rust
# docker run --rm -d --name prof_gui -v ./lprof_ext.json:/lprof_ext.json -p 5000:8080 ruprof/prof_gui:rust
