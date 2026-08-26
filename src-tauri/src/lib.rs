// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
    ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS,
    HBITMAP, HDC, RGBQUAD, SRCCOPY,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
};

/// Monotonically increasing id for the current crop session, bumped every
/// time `open_crop_window` starts a new one.
static CROP_GENERATION: AtomicU64 = AtomicU64::new(0);

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct CropRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct CapturedImage {
    pub image_base64: String,
    pub mime_type: String,
    pub rect: CropRect,
    pub session_id: u64,
    pub width: u32,
    pub height: u32,
}

/// Captures a rectangle of the screen using Win32 GDI into a BGRA byte buffer.
fn capture_screen_region(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(Vec<u8>, u32, u32), String> {
    if width <= 0 || height <= 0 {
        return Err("Invalid selection dimensions".to_string());
    }

    unsafe {
        let hdc_screen: HDC = GetDC(HWND::default());
        if hdc_screen.is_invalid() {
            return Err("Failed to get desktop DC".to_string());
        }

        let hdc_mem: HDC = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            ReleaseDC(HWND::default(), hdc_screen);
            return Err("Failed to create compatible memory DC".to_string());
        }

        let hbitmap: HBITMAP = CreateCompatibleBitmap(hdc_screen, width, height);
        if hbitmap.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(HWND::default(), hdc_screen);
            return Err("Failed to create compatible bitmap".to_string());
        }

        let old_obj = SelectObject(hdc_mem, hbitmap);

        // Capture screen pixels. CAPTUREBLT includes layered/transparent windows.
        let blt_res = BitBlt(
            hdc_mem,
            0,
            0,
            width,
            height,
            hdc_screen,
            x,
            y,
            SRCCOPY | CAPTUREBLT,
        );

        if let Err(e) = blt_res {
            SelectObject(hdc_mem, old_obj);
            let _ = DeleteObject(hbitmap);
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(HWND::default(), hdc_screen);
            return Err(format!("BitBlt failed: {:?}", e));
        }

        // Prepare 32-bit BGRA top-down DIB header
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // negative height for top-down row order
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default(); 1],
        };

        let mut buffer: Vec<u8> = vec![0u8; (width * height * 4) as usize];

        let lines = GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // Cleanup GDI handles
        SelectObject(hdc_mem, old_obj);
        let _ = DeleteObject(hbitmap);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(HWND::default(), hdc_screen);

        if lines == 0 {
            return Err("GetDIBits failed to read pixels".to_string());
        }

        Ok((buffer, width as u32, height as u32))
    }
}

/// Encodes raw Win32 BGRA pixel buffer to a Base64-encoded PNG image string (lossless).
fn bgra_to_png_base64(bgra: &[u8], width: u32, height: u32) -> Result<String, String> {
    use base64::prelude::*;
    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
    use image::{ColorType, ImageEncoder};

    let start_proc = std::time::Instant::now();
    eprintln!("[CROP PERF] IMAGE_PROCESSING_START");

    // Convert BGRA (Win32 GDI format) to RGBA (Standard PNG format)
    let mut rgba = Vec::with_capacity((width * height * 4) as usize);
    for chunk in bgra.chunks_exact(4) {
        rgba.push(chunk[2]); // R
        rgba.push(chunk[1]); // G
        rgba.push(chunk[0]); // B
        rgba.push(chunk[3]); // A
    }
    eprintln!(
        "[CROP PERF] IMAGE_PROCESSING_DONE ({:.2?})",
        start_proc.elapsed()
    );

    let start_png = std::time::Instant::now();
    eprintln!("[CROP PERF] PNG_START");

    let mut png_bytes = Vec::new();
    let encoder =
        PngEncoder::new_with_quality(&mut png_bytes, CompressionType::Fast, FilterType::NoFilter);
    encoder
        .write_image(&rgba, width, height, ColorType::Rgba8.into())
        .map_err(|e| format!("PNG encoding failed: {:?}", e))?;

    let encoded = BASE64_STANDARD.encode(&png_bytes);
    eprintln!(
        "[CROP PERF] PNG_DONE ({:.2?}, bytes={})",
        start_png.elapsed(),
        png_bytes.len()
    );

    Ok(encoded)
}

/// Forces the main window to keep a Windows taskbar button.
#[tauri::command]
fn ensure_taskbar_visible(window: tauri::WebviewWindow) -> Result<(), String> {
    let raw_hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let hwnd = HWND(raw_hwnd.0);
    unsafe {
        let old_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let new_style =
            (old_style | (WS_EX_APPWINDOW.0 as isize)) & !(WS_EX_TOOLWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);

        let _ = SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
    Ok(())
}

/// Opens the crop-overlay window hidden.
#[tauri::command]
async fn open_crop_window(app: tauri::AppHandle) -> Result<u64, String> {
    let session_id = CROP_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;

    // Close any stale crop window first
    if let Some(existing) = app.get_webview_window("crop-overlay") {
        let _ = existing.close();
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    let main_win = app
        .get_webview_window("main")
        .ok_or("main window not found")?;

    let monitor = main_win
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or_else(|| main_win.primary_monitor().ok().flatten());

    let mut builder = WebviewWindowBuilder::new(
        &app,
        "crop-overlay",
        WebviewUrl::App(format!("index.html?crop=true&session={}", session_id).into()),
    )
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .shadow(false)
    .visible(false); // Start hidden — show only after WebView paints

    if let Some(m) = monitor {
        let sf = m.scale_factor();
        let size = m.size();
        let pos = m.position();
        builder = builder
            .position(pos.x as f64 / sf, pos.y as f64 / sf)
            .inner_size(size.width as f64 / sf, size.height as f64 / sf);
    } else {
        builder = builder.fullscreen(true);
    }

    builder.build().map_err(|e| e.to_string())?;

    Ok(session_id)
}

/// Called by the crop-overlay React app once it has mounted and painted.
#[tauri::command]
async fn show_crop_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("crop-overlay") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Captures the selected screen region into a Base64-encoded JPEG image,
/// closes the crop overlay, restores the main LENS window, and emits `crop-image-captured`.
#[tauri::command]
async fn capture_screen_image(
    app: tauri::AppHandle,
    rect: CropRect,
) -> Result<CapturedImage, String> {
    let my_generation = CROP_GENERATION.load(Ordering::SeqCst);

    // 1. Query monitor geometry and scale factor BEFORE hiding the window.
    let (monitor_x, monitor_y, scale_factor) =
        if let Some(crop_win) = app.get_webview_window("crop-overlay") {
            let sf = crop_win.scale_factor().unwrap_or(1.0);
            let (m_x, m_y) = crop_win
                .current_monitor()
                .ok()
                .flatten()
                .map(|m| {
                    let pos = m.position();
                    (pos.x, pos.y)
                })
                .or_else(|| crop_win.outer_position().ok().map(|p| (p.x, p.y)))
                .unwrap_or((0, 0));
            (m_x, m_y, sf)
        } else {
            (0, 0, 1.0)
        };

    // Helper closure to ensure crop window is closed and main window restored
    let restore_windows = |app_handle: &tauri::AppHandle| {
        if let Some(crop_win) = app_handle.get_webview_window("crop-overlay") {
            let _ = crop_win.close();
        }
        if let Some(main_win) = app_handle.get_webview_window("main") {
            let _ = main_win.show();
            let _ = main_win.unminimize();
            let _ = main_win.set_focus();
        }
    };

    // 2. Hide the crop overlay window so it's not captured in the screenshot
    if let Some(crop_win) = app.get_webview_window("crop-overlay") {
        let _ = crop_win.hide();
    }

    // Small yield to ensure OS compositor has cleared the overlay
    std::thread::sleep(std::time::Duration::from_millis(35));

    // Check if superseded before running screen capture
    if CROP_GENERATION.load(Ordering::SeqCst) != my_generation {
        return Err("Crop session superseded".to_string());
    }

    // 3. Compute exact physical screen coordinates based on monitor origin and DPI scale
    let phys_x = monitor_x + (rect.x * scale_factor).round() as i32;
    let phys_y = monitor_y + (rect.y * scale_factor).round() as i32;
    let phys_w = (rect.width * scale_factor).round() as i32;
    let phys_h = (rect.height * scale_factor).round() as i32;

    if phys_w <= 0 || phys_h <= 0 {
        restore_windows(&app);
        return Err("Selection area too small".to_string());
    }

    // 4. Screen Capture via Win32 GDI
    eprintln!("[CROP PERF] IMAGE_CAPTURE_START");
    let capture_start = std::time::Instant::now();
    let (bgra_bytes, width, height) = capture_screen_region(phys_x, phys_y, phys_w, phys_h)
        .map_err(|e| {
            if CROP_GENERATION.load(Ordering::SeqCst) == my_generation {
                restore_windows(&app);
            }
            e
        })?;
    eprintln!(
        "[CROP PERF] IMAGE_CAPTURED ({:.2?})",
        capture_start.elapsed()
    );

    // 5. Encode to Base64 PNG image (lossless for AI Vision OCR accuracy)
    let image_base64 = bgra_to_png_base64(&bgra_bytes, width, height)?;

    let result = CapturedImage {
        image_base64,
        mime_type: "image/png".to_string(),
        rect,
        session_id: my_generation,
        width,
        height,
    };

    // Check again if superseded while encoding
    if CROP_GENERATION.load(Ordering::SeqCst) != my_generation {
        return Ok(result);
    }

    // 6. Close the crop overlay window and restore main window
    restore_windows(&app);

    // 7. Emit crop-image-captured event to main window
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("crop-image-captured", result.clone());
    }

    Ok(result)
}

/// Cancels crop mode: closes crop overlay, restores main LENS window, emits crop-cancelled.
#[tauri::command]
async fn cancel_crop(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(crop_win) = app.get_webview_window("crop-overlay") {
        let _ = crop_win.close();
    }

    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        let _ = main_win.unminimize();
        let _ = main_win.set_focus();
        let _ = main_win.emit("crop-cancelled", ());
    }

    Ok(())
}

/// Closes the crop-overlay window.
#[tauri::command]
async fn close_crop_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("crop-overlay") {
        let _ = win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ensure_taskbar_visible,
            open_crop_window,
            show_crop_window,
            capture_screen_image,
            cancel_crop,
            close_crop_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coordinate_scaling_calculation() {
        let sf = 1.0;
        let monitor_x = 0;
        let monitor_y = 0;
        let rect = CropRect {
            x: 100.0,
            y: 150.0,
            width: 300.0,
            height: 200.0,
        };
        let phys_x = monitor_x + (rect.x * sf).round() as i32;
        let phys_y = monitor_y + (rect.y * sf).round() as i32;
        let phys_w = (rect.width * sf).round() as i32;
        let phys_h = (rect.height * sf).round() as i32;
        assert_eq!((phys_x, phys_y, phys_w, phys_h), (100, 150, 300, 200));

        let sf_150 = 1.5;
        let phys_x_150 = monitor_x + (rect.x * sf_150).round() as i32;
        let phys_y_150 = monitor_y + (rect.y * sf_150).round() as i32;
        let phys_w_150 = (rect.width * sf_150).round() as i32;
        let phys_h_150 = (rect.height * sf_150).round() as i32;
        assert_eq!(
            (phys_x_150, phys_y_150, phys_w_150, phys_h_150),
            (150, 225, 450, 300)
        );
    }

    #[test]
    fn test_crop_generation_monotonic() {
        let gen1 = CROP_GENERATION.fetch_add(1, Ordering::SeqCst);
        let gen2 = CROP_GENERATION.fetch_add(1, Ordering::SeqCst);
        assert!(gen2 > gen1, "Crop generation must be strictly increasing");
    }

    #[test]
    fn test_png_base64_encoding() {
        let width = 2;
        let height = 2;
        // 4 pixels of solid red in BGRA: B=0, G=0, R=255, A=255
        let bgra = vec![0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255];
        let encoded = bgra_to_png_base64(&bgra, width, height).expect("Encoding must succeed");
        assert!(!encoded.is_empty(), "Encoded string must not be empty");
    }

    #[test]
    fn test_captured_image_serialization() {
        let img = CapturedImage {
            image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=".to_string(),
            mime_type: "image/png".to_string(),
            rect: CropRect { x: 10.0, y: 20.0, width: 100.0, height: 50.0 },
            session_id: 10,
            width: 100,
            height: 50,
        };
        let json = serde_json::to_string(&img).expect("Serialize must work");
        let deserialized: CapturedImage = serde_json::from_str(&json).expect("Deserialize must work");
        assert_eq!(deserialized.session_id, 10);
        assert_eq!(deserialized.mime_type, "image/png");
    }

    #[test]
    fn test_session_race_invalidation() {
        let active_session = 3u64;
        let mut completed_session = 0u64;

        // Session 1 finishes (stale) -> rejected
        if 1u64 >= active_session {
            completed_session = 1;
        }
        assert_ne!(completed_session, 1, "Session 1 must be rejected as stale");

        // Session 2 finishes (stale) -> rejected
        if 2u64 >= active_session {
            completed_session = 2;
        }
        assert_ne!(completed_session, 2, "Session 2 must be rejected as stale");

        // Session 3 finishes -> accepted
        if 3u64 >= active_session {
            completed_session = 3;
        }
        assert_eq!(completed_session, 3, "Session 3 must be accepted");
    }
}