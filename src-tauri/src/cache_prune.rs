use filetime::{set_file_mtime, FileTime};
use std::{
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

#[derive(Debug)]
struct CacheEntry {
    path: PathBuf,
    bytes: u64,
    last_used: SystemTime,
}

pub(crate) fn touch_cache_file(path: &Path) -> Result<(), String> {
    set_file_mtime(path, FileTime::now())
        .map_err(|error| format!("failed to update cache entry timestamp: {error}"))
}

pub(crate) fn remove_oversized_cache_file(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path)
            .map_err(|error| format!("failed to remove oversized cache entry: {error}"))?;
    }
    Ok(())
}

pub(crate) fn prune_cache_dir(cache_dir: &Path, max_total_bytes: u64) -> Result<(), String> {
    if !cache_dir.exists() {
        return Ok(());
    }

    let mut entries = Vec::new();
    let mut total_bytes = 0_u64;
    for entry in
        fs::read_dir(cache_dir).map_err(|error| format!("failed to read cache dir: {error}"))?
    {
        let entry = entry.map_err(|error| format!("failed to read cache entry: {error}"))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|error| format!("failed to read cache entry metadata: {error}"))?;
        if !metadata.is_file() {
            continue;
        }
        let bytes = metadata.len();
        total_bytes = total_bytes.saturating_add(bytes);
        entries.push(CacheEntry {
            path,
            bytes,
            last_used: metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH),
        });
    }

    if total_bytes <= max_total_bytes {
        return Ok(());
    }

    entries.sort_by_key(|entry| entry.last_used);
    for entry in entries {
        if total_bytes <= max_total_bytes {
            break;
        }
        fs::remove_file(&entry.path)
            .map_err(|error| format!("failed to remove cache entry: {error}"))?;
        total_bytes = total_bytes.saturating_sub(entry.bytes);
    }

    Ok(())
}
