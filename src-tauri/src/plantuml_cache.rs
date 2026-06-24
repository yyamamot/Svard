use std::{fs, path::Path};

use crate::{
    PlantUmlSvgCacheReadInput, PlantUmlSvgCacheReadResult, PlantUmlSvgCacheWriteInput,
    PlantUmlSvgCacheWriteResult, prune_cache_dir, remove_oversized_cache_file, touch_cache_file,
};

const MAX_PLANTUML_SVG_CACHE_BYTES: usize = 2 * 1024 * 1024;
const MAX_PLANTUML_SVG_CACHE_TOTAL_BYTES: u64 = 128 * 1024 * 1024;

pub(crate) fn read_plantuml_svg_cache_dir(
    input: PlantUmlSvgCacheReadInput,
    cache_dir: &Path,
) -> Result<PlantUmlSvgCacheReadResult, String> {
    let key = validate_plantuml_svg_cache_key(&input.key)?;
    let cache_file = cache_dir.join(cache_file_name(key));
    if !cache_file.exists() {
        return Ok(PlantUmlSvgCacheReadResult {
            status: "miss".to_string(),
            svg: None,
        });
    }
    let metadata = fs::metadata(&cache_file)
        .map_err(|error| format!("failed to read PlantUML cache metadata: {error}"))?;
    if metadata.len() as usize > MAX_PLANTUML_SVG_CACHE_BYTES {
        let _ = remove_oversized_cache_file(&cache_file);
        return Ok(PlantUmlSvgCacheReadResult {
            status: "miss".to_string(),
            svg: None,
        });
    }
    let _ = touch_cache_file(&cache_file);
    let svg = fs::read_to_string(&cache_file)
        .map_err(|error| format!("failed to read PlantUML cache: {error}"))?;
    Ok(PlantUmlSvgCacheReadResult {
        status: "hit".to_string(),
        svg: Some(svg),
    })
}

pub(crate) fn write_plantuml_svg_cache_dir(
    input: PlantUmlSvgCacheWriteInput,
    cache_dir: &Path,
) -> Result<PlantUmlSvgCacheWriteResult, String> {
    write_plantuml_svg_cache_dir_with_limit(input, cache_dir, MAX_PLANTUML_SVG_CACHE_TOTAL_BYTES)
}

pub(crate) fn write_plantuml_svg_cache_dir_with_limit(
    input: PlantUmlSvgCacheWriteInput,
    cache_dir: &Path,
    max_total_bytes: u64,
) -> Result<PlantUmlSvgCacheWriteResult, String> {
    let key = validate_plantuml_svg_cache_key(&input.key)?;
    if input.svg.len() > MAX_PLANTUML_SVG_CACHE_BYTES {
        return Ok(PlantUmlSvgCacheWriteResult {
            status: "skipped".to_string(),
        });
    }
    fs::create_dir_all(cache_dir)
        .map_err(|error| format!("failed to create PlantUML cache dir: {error}"))?;
    let cache_file = cache_dir.join(cache_file_name(key));
    let temp_file = cache_dir.join(format!("{key}.tmp"));
    fs::write(&temp_file, input.svg)
        .map_err(|error| format!("failed to write PlantUML cache temp file: {error}"))?;
    fs::rename(&temp_file, &cache_file)
        .map_err(|error| format!("failed to commit PlantUML cache file: {error}"))?;
    let _ = prune_cache_dir(cache_dir, max_total_bytes);
    Ok(PlantUmlSvgCacheWriteResult {
        status: "written".to_string(),
    })
}

pub(crate) fn clear_plantuml_svg_cache_dir(cache_dir: &Path) -> Result<(), String> {
    if cache_dir.exists() {
        fs::remove_dir_all(cache_dir).map_err(|error| {
            format!(
                "failed to clear PlantUML cache {}: {error}",
                cache_dir.display()
            )
        })?;
    }
    Ok(())
}

fn validate_plantuml_svg_cache_key(key: &str) -> Result<&str, String> {
    if key.len() == 64 && key.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(key)
    } else {
        Err("Invalid PlantUML cache key.".to_string())
    }
}

fn cache_file_name(key: &str) -> String {
    format!("{key}.svg")
}
