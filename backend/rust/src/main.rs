use axum::{
    extract::State,
    response::{Html, IntoResponse},
    routing::{get, Router},
    http::StatusCode,
};
use serde_json::{json, Value};
use std::{
    fs::File,
    io::Read,
    sync::{Arc, Mutex},
    time::UNIX_EPOCH,
};
use tera::{Context, Tera};
use tower_http::services::ServeDir;
use tracing::{debug, info, warn};

#[derive(Clone)]
struct AppState {
    profile_data: Arc<Mutex<Option<Value>>>,
    last_mtime: Arc<Mutex<u64>>,
}

async fn index(State(_): State<AppState>) -> impl IntoResponse {
    debug!("Handling / request");
    let tera = match Tera::new("/app/templates/*.html") {  // edit
        Ok(t) => t,
        Err(e) => {
            warn!("Failed to initialize Tera: {}", e);
            return Html("<h1>Error loading template</h1>").into_response();
        }
    };

    let context = Context::new();
    match tera.render("index.html", &context) {
        Ok(html) => {
            debug!("Rendered index.html successfully");
            Html(html).into_response()
        }
        Err(e) => {
            warn!("Template error: {}", e);
            Html("<h1>Error rendering template</h1>").into_response()
        }
    }
}

async fn get_data(State(state): State<AppState>) -> impl IntoResponse {
    debug!("Handling /data request");
    let data = load_profile_data(&state).await;
    axum::Json(data.unwrap_or(json!({})))
}

async fn get_data_timestamp(State(state): State<AppState>) -> impl IntoResponse {
    debug!("Handling /data_timestamp request");
    let data = load_profile_data(&state).await;
    let mtime = if data.is_none() {
        0 // Match Flask's behavior: return 0 if data is invalid
    } else {
        *state.last_mtime.lock().unwrap()
    };
    axum::Json(json!({ "mtime": mtime }))
}

async fn serve_profile_json() -> impl IntoResponse {
    debug!("Handling /profile.json request");
    let path = "/profile.json";
    match File::open(path) {
        Ok(mut file) => {
            let mut contents = String::new();
            match file.read_to_string(&mut contents) {
                Ok(_) => {
                    debug!("Successfully read /profile.json");
                    (
                        StatusCode::OK,
                        [("Content-Type", "application/json")],
                        contents,
                    ).into_response()
                }
                Err(e) => {
                    warn!("Failed to read /profile.json: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Error reading file").into_response()
                }
            }
        }
        Err(e) => {
            warn!("Failed to open /profile.json: {}", e);
            (StatusCode::NOT_FOUND, "").into_response() // Match Flask's behavior: return 404 if file not found
        }
    }
}

async fn load_profile_data(state: &AppState) -> Option<Value> {
    let path = "/profile.json";                                                 // edit
    debug!("Checking profile data at {}", path);
    let mut profile_data = state.profile_data.lock().unwrap();
    let mut last_mtime = state.last_mtime.lock().unwrap();

    let current_mtime = match File::open(path)
        .and_then(|f| f.metadata())
        .and_then(|m| m.modified())
        .map(|t| {
            t.duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0)
        }) {
        Ok(mtime) => mtime,
        Err(e) => {
            warn!("Failed to get mtime for {}: {}", path, e);
            *profile_data = None;
            return None;
        }
    };

    if current_mtime > *last_mtime {
        debug!("Reloading profile data due to newer mtime: {}", current_mtime);
        let data = match File::open(path)
            .and_then(|mut f| {
                let mut contents = String::new();
                f.read_to_string(&mut contents)?;
                Ok(contents)
            })
            .and_then(|contents| {
                serde_json::from_str(&contents)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
            }) {
            Ok(data) => data,
            Err(e) => {
                warn!("Failed to load {}: {}", path, e);
                *profile_data = None;
                return None;
            }
        };
        *profile_data = Some(data);
        *last_mtime = current_mtime;
    } else {
        debug!("Using cached profile data");
    }

    profile_data.clone()
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG) // More verbose for debugging
        .init();

    let state = AppState {
        profile_data: Arc::new(Mutex::new(None)),
        last_mtime: Arc::new(Mutex::new(0)),
    };

    let app = Router::new()
        .route("/", get(index))
        .route("/data", get(get_data))
        .route("/data_timestamp", get(get_data_timestamp))
        .route("/profile.json", get(serve_profile_json))
        .nest_service("/static", ServeDir::new("/app/static")) // Serve static files   // edit
        .with_state(state);

    let addr = "0.0.0.0:8080";
    info!("Starting server on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// find `// edit` for static / html / json file location
