// LogicSim desktop shell: the entire app is the shared web bundle; this
// process only provides the window and the dialog/fs plugins the storage
// adapter invokes (see apps/web/src/lib/storage.ts).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running LogicSim");
}
