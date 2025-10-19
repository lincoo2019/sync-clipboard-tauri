use reqwest_dav::{Client, ClientBuilder, Auth};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WebDAVError {
    #[error("WebDAV client error: {0}")]
    ClientError(#[from] reqwest_dav::Error),
    #[error("HTTP client error: {0}")]
    HttpError(String),
    #[error("Configuration error: {0}")]
    ConfigError(String),
    #[error("Network error: {0}")]
    NetworkError(String),
}

pub type WebDAVResult<T> = Result<T, WebDAVError>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WebDAVConfig {
    pub host_url: String,
    pub username: String,
    pub password: String,
    pub destination_dir: String,
}

impl Default for WebDAVConfig {
    fn default() -> Self {
        Self {
            host_url: String::new(),
            username: String::new(),
            password: String::new(),
            destination_dir: "/clipboard-sync".to_string(),
        }
    }
}

#[derive(Debug)]
pub struct WebDAVClient {
    config: WebDAVConfig,
    client: Option<Client>,
}

impl WebDAVClient {
    pub fn new(config: WebDAVConfig) -> Self {
        let mut client = Self {
            config,
            client: None,
        };

        client.init_client();
        client
    }

    fn init_client(&mut self) {
        if self.config.host_url.is_empty() || self.config.username.is_empty() {
            return;
        }

        self.client = ClientBuilder::new()
            .set_host(self.config.host_url.clone())
            .set_auth(Auth::Basic(
                self.config.username.clone(),
                self.config.password.clone(),
            ))
            .build()
            .ok();
    }

    pub fn update_config(&mut self, config: WebDAVConfig) {
        self.config = config;
        self.init_client();
    }

    pub fn get_full_path(&self, filename: &str) -> String {
        let base_path = self.config.destination_dir.trim_end_matches('/');
        format!("{}/{}", base_path, filename)
    }

    pub async fn test_connection(&self) -> WebDAVResult<bool> {
        let client = self.client.as_ref()
            .ok_or_else(|| WebDAVError::ConfigError("WebDAV client not initialized".to_string()))?;

        // Try to create destination directory if it doesn't exist
        let _ = client.mkcol(&self.config.destination_dir).await;

        // Test by uploading and downloading a small test file
        let test_filename = format!("{}/test-connection.txt", self.config.destination_dir);
        let test_content = b"WebDAV connection test";

        // Upload test file
        client.put(&test_filename, test_content.to_vec()).await?;

        // Download test file
        let response = client.get(&test_filename).await?;
        let downloaded_content = response.bytes().await
            .map_err(|e| WebDAVError::HttpError(e.to_string()))?;

        // Clean up test file
        let _ = client.delete(&test_filename).await;

        Ok(*downloaded_content == *test_content)
    }

    pub async fn upload_clipboard_data(&self, data: &[u8]) -> WebDAVResult<()> {
        let client = self.client.as_ref()
            .ok_or_else(|| WebDAVError::ConfigError("WebDAV client not initialized".to_string()))?;

        let filename = "SyncClipboard.json";
        let full_path = self.get_full_path(filename);

        // Ensure destination directory exists
        let _ = client.mkcol(&self.config.destination_dir).await;

        client.put(&full_path, data.to_vec()).await?;

        Ok(())
    }

    pub async fn download_clipboard_data(&self) -> WebDAVResult<Option<Vec<u8>>> {
        let client = self.client.as_ref()
            .ok_or_else(|| WebDAVError::ConfigError("WebDAV client not initialized".to_string()))?;

        let filename = "SyncClipboard.json";
        let full_path = self.get_full_path(filename);

        match client.get(&full_path).await {
            Ok(response) => {
                let bytes = response.bytes().await
                    .map_err(|e| WebDAVError::HttpError(e.to_string()))?;
                Ok(Some(bytes.to_vec()))
            }
            Err(reqwest_dav::Error::Decode(decode_error)) => {
                match &decode_error {
                    reqwest_dav::DecodeError::Server(server_error) => {
                        if server_error.response_code == 404 {
                            return Ok(None); // File not found is not an error
                        }
                    }
                    _ => {}
                }
                Err(WebDAVError::ClientError(reqwest_dav::Error::Decode(decode_error)))
            }
            Err(e) => Err(WebDAVError::ClientError(e)),
        }
    }
}

// Tauri state for WebDAV client
pub struct WebDAVState {
    pub client: std::sync::Mutex<WebDAVClient>,
}

impl WebDAVState {
    pub fn new() -> Self {
        Self {
            client: std::sync::Mutex::new(WebDAVClient::new(WebDAVConfig::default())),
        }
    }
}

// Tauri commands
#[tauri::command]
pub async fn webdav_test_connection(config: WebDAVConfig) -> Result<bool, String> {
    let client = WebDAVClient::new(config);
    client.test_connection().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn webdav_upload_clipboard(
    config: WebDAVConfig,
    data: Vec<u8>,
) -> Result<(), String> {
    let client = WebDAVClient::new(config);
    client.upload_clipboard_data(&data).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn webdav_download_clipboard(
    config: WebDAVConfig,
) -> Result<Option<Vec<u8>>, String> {
    let client = WebDAVClient::new(config);
    client.download_clipboard_data().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_default_webdav_config() -> WebDAVConfig {
    WebDAVConfig::default()
}