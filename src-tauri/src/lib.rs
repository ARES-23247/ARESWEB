use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::path::{Path, PathBuf};
use std::io::{BufReader, BufRead};
use std::env;
use tauri::{AppHandle, Emitter, State};

struct AppState {
    active_process: Arc<Mutex<Option<Child>>>,
}

#[derive(serde::Serialize, Clone)]
struct Diagnostics {
    jdk_valid: bool,
    jdk_version: String,
    gradlew_exists: bool,
    repo_root: String,
    git_exists: bool,
    git_version: String,
}

#[derive(serde::Serialize, Clone)]
struct LogPayload {
    line: String,
}

#[derive(serde::Serialize, Clone)]
struct ExitPayload {
    code: i32,
    success: bool,
}

// Helper to find the robot repository root relative to ARESWEB (sibling directory)
fn get_repo_root() -> PathBuf {
    let mut path = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("..");
    path.push("ARESLib-Kotlin");
    
    if path.exists() {
        path.canonicalize().unwrap_or(path)
    } else {
        path
    }
}

#[tauri::command]
fn check_env() -> Diagnostics {
    let repo_root = get_repo_root();
    let gradlew_name = if cfg!(target_os = "windows") { "gradlew.bat" } else { "gradlew" };
    let gradlew_exists = repo_root.join(gradlew_name).exists();

    // Check JDK
    let mut jdk_valid = false;
    let mut jdk_version = String::from("Unknown");

    let mut cmd = Command::new("java");
    cmd.arg("-version");
    
    if cfg!(target_os = "windows") {
        let jdk_path = Path::new("C:\\Program Files\\Java\\jdk-17");
        if jdk_path.exists() {
            let mut paths = env::var_os("PATH").unwrap_or_default();
            let bin_path = jdk_path.join("bin");
            if let Some(path_str) = env::join_paths(std::iter::once(bin_path).chain(env::split_paths(&paths))).ok() {
                paths = path_str;
            }
            cmd.env("PATH", paths);
            cmd.env("JAVA_HOME", jdk_path);
        }
    }

    if let Ok(output) = cmd.output() {
        let output_str = String::from_utf8_lossy(&output.stderr);
        let check_str = if output_str.is_empty() {
            String::from_utf8_lossy(&output.stdout)
        } else {
            output_str
        };

        if let Some(line) = check_str.lines().next() {
            jdk_version = line.to_string();
            // Check for modern JDK version (17, 18, 19, 21, etc.)
            if line.contains("17") || line.contains("18") || line.contains("19") || line.contains("21") || line.contains("22") || line.contains("23") {
                jdk_valid = true;
            }
        }
    } else {
        jdk_version = String::from("Java not found on PATH");
    }

    // Check Git
    let mut git_exists = false;
    let mut git_version = String::from("Git not found on PATH");
    let mut git_cmd = Command::new("git");
    git_cmd.arg("--version");
    
    if let Ok(output) = git_cmd.output() {
        let output_str = String::from_utf8_lossy(&output.stdout);
        if let Some(line) = output_str.lines().next() {
            git_version = line.to_string();
            git_exists = true;
        }
    }

    Diagnostics {
        jdk_valid,
        jdk_version,
        gradlew_exists,
        repo_root: repo_root.to_string_lossy().to_string(),
        git_exists,
        git_version,
    }
}

#[tauri::command]
fn stop_process(state: State<'_, AppState>) -> Result<String, String> {
    let mut process_guard = state.active_process.lock().unwrap();
    if let Some(mut child) = process_guard.take() {
        #[cfg(target_os = "windows")]
        {
            // On Windows, child.kill() doesn't terminate child processes launched via shell.
            // We use taskkill to gracefully kill the entire process tree.
            let pid = child.id();
            let mut kill_cmd = Command::new("taskkill");
            kill_cmd.args(&["/F", "/T", "/PID", &pid.to_string()]);
            let _ = kill_cmd.output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = child.kill();
        }
        Ok("Process stopped successfully.".to_string())
    } else {
        Err("No active process running.".to_string())
    }
}

#[tauri::command]
fn start_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_name: String,
    args: Vec<String>,
    obstacles_json: Option<String>,
    elements_json: Option<String>,
    config_id: Option<String>,
) -> Result<String, String> {
    // 1. Terminate any active running task
    let _ = stop_process(state.clone());

    let repo_root = get_repo_root();
    
    // 2. Write configuration overrides if parameters are provided (for simulator EKF/layout configurations)
    if let Some(ref conf_id) = config_id {
        let config_override_path = repo_root.join("config_override.json");
        let config_override_sim_path = repo_root.join("simulator").join("config_override.json");
        
        let mut override_map = serde_json::Map::new();
        override_map.insert("configId".to_string(), serde_json::Value::String(conf_id.clone()));
        
        if let Some(obs) = obstacles_json {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&obs) {
                override_map.insert("obstacles".to_string(), val);
            }
        }
        if let Some(els) = elements_json {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&els) {
                override_map.insert("elements".to_string(), val);
            }
        }
        
        let override_val = serde_json::Value::Object(override_map);
        if let Ok(config_str) = serde_json::to_string_pretty(&override_val) {
            let _ = std::fs::write(&config_override_path, &config_str);
            let _ = std::fs::write(&config_override_sim_path, &config_str);
            let _ = app.emit("sim-log", LogPayload { line: format!("[Tauri] Wrote config overrides for config: {}", conf_id) });
        }
    }

    // 3. Configure Gradle execution command
    let gradlew_cmd = if cfg!(target_os = "windows") { "gradlew.bat" } else { "./gradlew" };
    let mut cmd = Command::new(gradlew_cmd);
    cmd.args(&args);
    cmd.current_dir(&repo_root);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    
    // Configure Java environment variable injections on Windows
    if cfg!(target_os = "windows") {
        let jdk_path = Path::new("C:\\Program Files\\Java\\jdk-17");
        if jdk_path.exists() {
            let mut paths = env::var_os("PATH").unwrap_or_default();
            let bin_path = jdk_path.join("bin");
            if let Some(path_str) = env::join_paths(std::iter::once(bin_path).chain(env::split_paths(&paths))).ok() {
                paths = path_str;
            }
            cmd.env("PATH", paths);
            cmd.env("JAVA_HOME", jdk_path);
        }
        cmd.env("JAVA_OPTS", "-XX:+UseG1GC");
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut process_guard = state.active_process.lock().unwrap();
        *process_guard = Some(child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let active_process = Arc::clone(&state.active_process);
    let app_exit = app.clone();

    // Spawn stdout reading thread
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stdout.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn stderr reading thread
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stderr.emit("sim-log", LogPayload { line: format!("[ERROR] {}", line_str) });
            }
        }
    });

    // Spawn exit waiter thread
    std::thread::spawn(move || {
        let status = {
            let mut process_guard = active_process.lock().unwrap();
            if let Some(child) = process_guard.as_mut() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(exit_status) = status {
            let code = exit_status.code().unwrap_or(0);
            let success = exit_status.success();
            let _ = app_exit.emit("sim-exit", ExitPayload { code, success });
        }
        
        let mut process_guard = active_process.lock().unwrap();
        *process_guard = None;
    });

    Ok(format!("Started task: {}", task_name))
}

#[tauri::command]
fn deploy_via_adb(app: AppHandle, state: State<'_, AppState>, robot_ip: String) -> Result<String, String> {
    // 1. Terminate any active running task
    let _ = stop_process(state.clone());

    let repo_root = get_repo_root();
    
    // 2. Resolve ADB path
    let adb_path = if cfg!(target_os = "windows") {
        let local_app_data = env::var("LOCALAPPDATA").unwrap_or_default();
        format!("{}\\Android\\Sdk\\platform-tools\\adb.exe", local_app_data)
    } else {
        "adb".to_string()
    };
    
    let apk_path = repo_root.join("ftc-app").join("TeamCode").join("build").join("outputs").join("apk").join("debug").join("TeamCode-debug.apk");
    
    let shell_cmd = if cfg!(target_os = "windows") {
        format!("\"{}\" connect {}:5555 && \"{}\" -s {}:5555 install -r \"{}\"", adb_path, robot_ip, adb_path, robot_ip, apk_path.to_string_lossy())
    } else {
        format!("adb connect {}:5555 && adb -s {}:5555 install -r \"{}\"", robot_ip, robot_ip, apk_path.to_string_lossy())
    };

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd.exe");
        c.args(&["/c", &shell_cmd]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(&["-c", &shell_cmd]);
        c
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ADB command: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut process_guard = state.active_process.lock().unwrap();
        *process_guard = Some(child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let active_process = Arc::clone(&state.active_process);
    let app_exit = app.clone();

    // Spawn stdout reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stdout.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn stderr reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stderr.emit("sim-log", LogPayload { line: format!("[ERROR] {}", line_str) });
            }
        }
    });

    // Spawn exit waiter
    std::thread::spawn(move || {
        let status = {
            let mut process_guard = active_process.lock().unwrap();
            if let Some(child) = process_guard.as_mut() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(exit_status) = status {
            let code = exit_status.code().unwrap_or(0);
            let success = exit_status.success();
            let _ = app_exit.emit("sim-exit", ExitPayload { code, success });
        }
        
        let mut process_guard = active_process.lock().unwrap();
        *process_guard = None;
    });

    Ok("Starting ADB deployment...".to_string())
}

#[tauri::command]
fn install_jdk_winget(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    // 1. Terminate any active running task
    let _ = stop_process(state.clone());

    // 2. Configure installation command
    let shell_cmd = "winget install --id EclipseAdoptium.Temurin.17.JDK --silent --accept-source-agreements --accept-package-agreements";
    
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd.exe");
        c.args(&["/c", shell_cmd]);
        c
    } else {
        return Err("Auto-installation of JDK 17 via winget is only supported on Windows. Please install manually on other platforms.".to_string());
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn winget command: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut process_guard = state.active_process.lock().unwrap();
        *process_guard = Some(child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let active_process = Arc::clone(&state.active_process);
    let app_exit = app.clone();

    // Spawn stdout reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stdout.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn stderr reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stderr.emit("sim-log", LogPayload { line: format!("[ERROR] {}", line_str) });
            }
        }
    });

    // Spawn exit waiter
    std::thread::spawn(move || {
        let status = {
            let mut process_guard = active_process.lock().unwrap();
            if let Some(child) = process_guard.as_mut() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(exit_status) = status {
            let code = exit_status.code().unwrap_or(0);
            let success = exit_status.success();
            let _ = app_exit.emit("sim-exit", ExitPayload { code, success });
        }
        
        let mut process_guard = active_process.lock().unwrap();
        *process_guard = None;
    });

    Ok("Starting JDK 17 installation via winget... Please check the log terminal for progress.".to_string())
}

#[tauri::command]
fn clone_robot_repo(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    // 1. Terminate any active running task
    let _ = stop_process(state.clone());

    let repo_root = get_repo_root();
    
    // Check if the sibling directory already exists
    if repo_root.exists() {
        return Err("ARESLib-Kotlin repository already exists at the sibling path. Please check or rename the folder if you want to re-clone.".to_string());
    }

    // 2. Configure Git Clone command
    let clone_cmd = "git clone https://github.com/ARES-23247/ARESLib-Kotlin.git ../ARESLib-Kotlin";
    
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd.exe");
        c.args(&["/c", clone_cmd]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(&["-c", clone_cmd]);
        c
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn git clone command: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut process_guard = state.active_process.lock().unwrap();
        *process_guard = Some(child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let active_process = Arc::clone(&state.active_process);
    let app_exit = app.clone();

    // Spawn stdout reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stdout.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn stderr reader (Git clone progress writes to stderr)
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stderr.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn exit waiter
    std::thread::spawn(move || {
        let status = {
            let mut process_guard = active_process.lock().unwrap();
            if let Some(child) = process_guard.as_mut() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(exit_status) = status {
            let code = exit_status.code().unwrap_or(0);
            let success = exit_status.success();
            let _ = app_exit.emit("sim-exit", ExitPayload { code, success });
        }
        
        let mut process_guard = active_process.lock().unwrap();
        *process_guard = None;
    });

    Ok("Starting Git clone of ARESLib-Kotlin... Please check the log terminal for progress.".to_string())
}

#[tauri::command]
fn install_tuner_x(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    // 1. Terminate any active running task
    let _ = stop_process(state.clone());

    // 2. Configure installation command
    let shell_cmd = "winget install --id CTR-Electronics.PhoenixTunerX --silent --accept-source-agreements --accept-package-agreements";
    
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd.exe");
        c.args(&["/c", shell_cmd]);
        c
    } else {
        return Err("Auto-installation of CTRE Phoenix Tuner X is only supported on Windows. Please install manually on other platforms.".to_string());
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn winget command: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut process_guard = state.active_process.lock().unwrap();
        *process_guard = Some(child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let active_process = Arc::clone(&state.active_process);
    let app_exit = app.clone();

    // Spawn stdout reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stdout.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn stderr reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stderr.emit("sim-log", LogPayload { line: format!("[ERROR] {}", line_str) });
            }
        }
    });

    // Spawn exit waiter
    std::thread::spawn(move || {
        let status = {
            let mut process_guard = active_process.lock().unwrap();
            if let Some(child) = process_guard.as_mut() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(exit_status) = status {
            let code = exit_status.code().unwrap_or(0);
            let success = exit_status.success();
            let _ = app_exit.emit("sim-exit", ExitPayload { code, success });
        }
        
        let mut process_guard = active_process.lock().unwrap();
        *process_guard = None;
    });

    Ok("Starting CTRE Phoenix Tuner X installation via winget... Please check the log terminal for progress.".to_string())
}

#[tauri::command]
fn install_git_winget(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    // 1. Terminate any active running task
    let _ = stop_process(state.clone());

    // 2. Configure installation command
    let shell_cmd = "winget install --id Git.Git --silent --accept-source-agreements --accept-package-agreements";
    
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd.exe");
        c.args(&["/c", shell_cmd]);
        c
    } else {
        return Err("Auto-installation of Git via winget is only supported on Windows. Please install manually on other platforms.".to_string());
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn winget command: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut process_guard = state.active_process.lock().unwrap();
        *process_guard = Some(child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let active_process = Arc::clone(&state.active_process);
    let app_exit = app.clone();

    // Spawn stdout reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stdout.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn stderr reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stderr.emit("sim-log", LogPayload { line: format!("[ERROR] {}", line_str) });
            }
        }
    });

    // Spawn exit waiter
    std::thread::spawn(move || {
        let status = {
            let mut process_guard = active_process.lock().unwrap();
            if let Some(child) = process_guard.as_mut() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(exit_status) = status {
            let code = exit_status.code().unwrap_or(0);
            let success = exit_status.success();
            let _ = app_exit.emit("sim-exit", ExitPayload { code, success });
        }
        
        let mut process_guard = active_process.lock().unwrap();
        *process_guard = None;
    });

    Ok("Starting Git installation via winget... Please check the log terminal for progress.".to_string())
}

#[tauri::command]
fn install_github_cli_winget(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    // 1. Terminate any active running task
    let _ = stop_process(state.clone());

    // 2. Configure installation command
    let shell_cmd = "winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements";
    
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd.exe");
        c.args(&["/c", shell_cmd]);
        c
    } else {
        return Err("Auto-installation of GitHub CLI via winget is only supported on Windows. Please install manually on other platforms.".to_string());
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn winget command: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut process_guard = state.active_process.lock().unwrap();
        *process_guard = Some(child);
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let active_process = Arc::clone(&state.active_process);
    let app_exit = app.clone();

    // Spawn stdout reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stdout.emit("sim-log", LogPayload { line: line_str });
            }
        }
    });

    // Spawn stderr reader
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line_str) = line {
                let _ = app_stderr.emit("sim-log", LogPayload { line: format!("[ERROR] {}", line_str) });
            }
        }
    });

    // Spawn exit waiter
    std::thread::spawn(move || {
        let status = {
            let mut process_guard = active_process.lock().unwrap();
            if let Some(child) = process_guard.as_mut() {
                child.wait().ok()
            } else {
                None
            }
        };

        if let Some(exit_status) = status {
            let code = exit_status.code().unwrap_or(0);
            let success = exit_status.success();
            let _ = app_exit.emit("sim-exit", ExitPayload { code, success });
        }
        
        let mut process_guard = active_process.lock().unwrap();
        *process_guard = None;
    });

    Ok("Starting GitHub CLI installation via winget... Please check the log terminal for progress.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AppState {
        active_process: Arc::new(Mutex::new(Option::None)),
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        check_env,
        start_task,
        stop_process,
        deploy_via_adb,
        install_jdk_winget,
        clone_robot_repo,
        install_tuner_x,
        install_git_winget,
        install_github_cli_winget
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
