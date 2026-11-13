use std::fs;
use std::path::Path;

fn is_markdown(path: &str) -> bool {
    let p = Path::new(path);
    p.extension().and_then(|ext| ext.to_str()).map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown" | "txt")).unwrap_or(false)
}

#[tauri::command]
fn read_markdown(path: String) -> Result<String, String> {
    if !is_markdown(&path) { return Err("Only .md, .markdown, and .txt files are supported".into()); }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_markdown(path: String, content: String) -> Result<(), String> {
    if !is_markdown(&path) { return Err("Only .md, .markdown, and .txt files are supported".into()); }
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_markdown(path: String, new_name: String) -> Result<String, String> {
    if !is_markdown(&new_name) { return Err("Only .md, .markdown, and .txt files are supported".into()); }
    if new_name.contains(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) { return Err("Invalid file name".into()); }
    let from = Path::new(&path);
    let to = from.with_file_name(&new_name);
    if to.exists() { return Err(format!("{} already exists", new_name)); }
    fs::rename(from, &to).map_err(|e| e.to_string())?;
    Ok(to.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_markdown, write_markdown, rename_markdown])
        .run(tauri::generate_context!())
        .expect("error while running Inkdown");
}
