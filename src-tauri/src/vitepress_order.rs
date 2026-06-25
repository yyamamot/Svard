use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use crate::{
    backend_types::{
        AllowedRoots, DocumentOrderDocumentStatus, DocumentOrderNode, DocumentOrderResult,
        DocumentOrderSource,
    },
    document_order_common::{
        display_title_from_path, none_result, normalize_document_order_target_path,
    },
    path_policy::{ensure_path_allowed, path_to_ui_string},
};

const CONFIG_EXTENSIONS: [&str; 4] = ["ts", "mts", "js", "mjs"];

#[derive(Debug, Clone, PartialEq, Eq)]
enum StaticValue {
    Object(Vec<(String, StaticValue)>),
    Array(Vec<StaticValue>),
    String(String),
    Identifier(String),
    Unsupported,
}

pub(crate) fn load_vitepress_order_from_root(
    root: &Path,
    roots: &AllowedRoots,
) -> DocumentOrderResult {
    let Some(config_path) = find_vitepress_config(root) else {
        return none_result(None);
    };
    if ensure_path_allowed(&config_path, roots).is_err() {
        return none_result(Some(
            "VitePress configuration is outside the workspace.".to_string(),
        ));
    }
    let source = match fs::read_to_string(&config_path) {
        Ok(source) => source,
        Err(_) => {
            return none_result(Some(
                "VitePress configuration could not be read.".to_string(),
            ));
        }
    };
    let Some(sidebar) = extract_sidebar_value(&source) else {
        return none_result(Some(
            "VitePress sidebar is not configured as a static value.".to_string(),
        ));
    };
    if matches!(
        sidebar,
        StaticValue::Unsupported | StaticValue::Identifier(_)
    ) {
        return none_result(Some(
            "VitePress sidebar is not configured as a static value.".to_string(),
        ));
    }
    let docs_root = config_path
        .parent()
        .and_then(Path::parent)
        .unwrap_or(root)
        .to_path_buf();
    let nodes = sidebar_nodes(&sidebar, &docs_root, roots);
    if nodes.is_empty() {
        return none_result(Some(
            "VitePress sidebar did not contain local document entries.".to_string(),
        ));
    }

    DocumentOrderResult {
        source: DocumentOrderSource::Vitepress,
        nodes,
        message: None,
    }
}

fn find_vitepress_config(root: &Path) -> Option<PathBuf> {
    [
        root.join(".vitepress"),
        root.join("docs").join(".vitepress"),
    ]
    .into_iter()
    .flat_map(|dir| {
        CONFIG_EXTENSIONS
            .iter()
            .map(move |extension| dir.join(format!("config.{extension}")))
    })
    .find(|path| path.is_file())
    .map(|path| normalize_document_order_target_path(&path))
}

fn extract_sidebar_value(source: &str) -> Option<StaticValue> {
    let bindings = collect_static_bindings(source);
    let theme_config = find_theme_config(source)?;
    let sidebar = object_property(&theme_config, "sidebar")?.clone();
    match sidebar {
        StaticValue::Identifier(name) => bindings.get(&name).cloned(),
        value => Some(value),
    }
}

fn collect_static_bindings(source: &str) -> BTreeMap<String, StaticValue> {
    let mut bindings = BTreeMap::new();
    let mut offset = 0;
    while let Some(found) = source[offset..].find("const") {
        let start = offset + found;
        if !is_word_boundary(source, start, 5) {
            offset = start + 5;
            continue;
        }
        let mut parser = StaticParser::new(&source[start + 5..]);
        let Some(name) = parser.parse_identifier() else {
            offset = start + 5;
            continue;
        };
        if !parser.skip_until_equals() {
            offset = start + 5;
            continue;
        }
        let value = parser.parse_value();
        if !matches!(value, StaticValue::Unsupported) {
            bindings.insert(name, value);
        }
        offset = start + 5;
    }
    bindings
}

fn find_theme_config(source: &str) -> Option<StaticValue> {
    let mut offset = 0;
    while let Some(found) = source[offset..].find("themeConfig") {
        let start = offset + found;
        if !is_word_boundary(source, start, "themeConfig".len()) {
            offset = start + "themeConfig".len();
            continue;
        }
        let mut parser = StaticParser::new(&source[start + "themeConfig".len()..]);
        parser.skip_ws_and_comments();
        if parser.peek_char() != Some(':') {
            offset = start + "themeConfig".len();
            continue;
        }
        parser.consume_char();
        let value = parser.parse_value();
        if matches!(value, StaticValue::Object(_)) {
            return Some(value);
        }
        offset = start + "themeConfig".len();
    }
    None
}

fn is_word_boundary(source: &str, start: usize, len: usize) -> bool {
    let before = source[..start].chars().next_back();
    let after = source[start + len..].chars().next();
    !before.is_some_and(is_identifier_char) && !after.is_some_and(is_identifier_char)
}

fn object_property<'a>(value: &'a StaticValue, key: &str) -> Option<&'a StaticValue> {
    let StaticValue::Object(entries) = value else {
        return None;
    };
    entries
        .iter()
        .find_map(|(entry_key, entry_value)| (entry_key == key).then_some(entry_value))
}

fn sidebar_nodes(
    sidebar: &StaticValue,
    docs_root: &Path,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    match sidebar {
        StaticValue::Array(items) => parse_sidebar_items(items, docs_root, 0, roots),
        StaticValue::Object(entries) => entries
            .iter()
            .filter_map(|(base, value)| {
                let StaticValue::Array(items) = value else {
                    return None;
                };
                let children = parse_sidebar_items(items, docs_root, 1, roots);
                (!children.is_empty()).then(|| DocumentOrderNode::Section {
                    title: sidebar_base_title(base),
                    depth: 0,
                    children,
                })
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn parse_sidebar_items(
    items: &[StaticValue],
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> Vec<DocumentOrderNode> {
    let mut nodes = Vec::new();
    for item in items {
        match item {
            StaticValue::String(link) => {
                nodes.push(sidebar_document(
                    display_title_from_path(link),
                    link,
                    docs_root,
                    depth,
                    roots,
                ));
            }
            StaticValue::Object(_) => {
                let title = object_property(item, "text")
                    .and_then(static_string)
                    .map(str::to_string);
                let link = object_property(item, "link").and_then(static_string);
                let children = object_property(item, "items")
                    .and_then(static_array)
                    .map(|items| parse_sidebar_items(items, docs_root, depth + 1, roots))
                    .unwrap_or_default();
                match (title, link, children.is_empty()) {
                    (Some(title), Some(link), true) => {
                        nodes.push(sidebar_document(title, link, docs_root, depth, roots));
                    }
                    (Some(title), Some(link), false) => {
                        let mut section_children = vec![sidebar_document(
                            title.clone(),
                            link,
                            docs_root,
                            depth + 1,
                            roots,
                        )];
                        section_children.extend(children);
                        nodes.push(DocumentOrderNode::Section {
                            title,
                            depth,
                            children: section_children,
                        });
                    }
                    (Some(title), None, false) => {
                        nodes.push(DocumentOrderNode::Section {
                            title,
                            depth,
                            children,
                        });
                    }
                    (None, Some(link), true) => {
                        nodes.push(sidebar_document(
                            display_title_from_path(link),
                            link,
                            docs_root,
                            depth,
                            roots,
                        ));
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    nodes
}

fn static_string(value: &StaticValue) -> Option<&str> {
    match value {
        StaticValue::String(value) => Some(value),
        _ => None,
    }
}

fn static_array(value: &StaticValue) -> Option<&[StaticValue]> {
    match value {
        StaticValue::Array(items) => Some(items),
        _ => None,
    }
}

fn sidebar_base_title(base: &str) -> String {
    let title = base.trim_matches('/');
    if title.is_empty() {
        "VitePress".to_string()
    } else {
        title.replace('/', " / ")
    }
}

fn sidebar_document(
    title: String,
    target: &str,
    docs_root: &Path,
    depth: usize,
    roots: &AllowedRoots,
) -> DocumentOrderNode {
    let display_path = target.to_string();
    let Some(candidate) = vitepress_link_candidate(target, docs_root) else {
        return DocumentOrderNode::Document {
            title,
            path: String::new(),
            display_path,
            depth,
            status: DocumentOrderDocumentStatus::External,
        };
    };
    if ensure_path_allowed(&candidate, roots).is_err() {
        return DocumentOrderNode::Document {
            title,
            path: String::new(),
            display_path,
            depth,
            status: DocumentOrderDocumentStatus::Unsupported,
        };
    }
    if candidate.is_file() {
        return DocumentOrderNode::Document {
            title,
            path: path_to_ui_string(&candidate),
            display_path,
            depth,
            status: DocumentOrderDocumentStatus::Resolved,
        };
    }
    DocumentOrderNode::Document {
        title,
        path: String::new(),
        display_path,
        depth,
        status: DocumentOrderDocumentStatus::Missing,
    }
}

fn vitepress_link_candidate(target: &str, docs_root: &Path) -> Option<PathBuf> {
    if is_external_or_unsafe_vitepress_link(target) {
        return None;
    }
    let target = target.split(['#', '?']).next().unwrap_or_default().trim();
    if target.is_empty() {
        return None;
    }
    let target = target.trim_start_matches('/');
    if target.is_empty() || target.ends_with('/') {
        return Some(normalize_document_order_target_path(
            &docs_root.join(target).join("index.md"),
        ));
    }
    let candidate = docs_root.join(target);
    if candidate.extension().is_some() {
        let extension = candidate
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if extension.eq_ignore_ascii_case("md") {
            return Some(normalize_document_order_target_path(&candidate));
        }
        return None;
    }
    let markdown_candidate = normalize_document_order_target_path(&candidate.with_extension("md"));
    if markdown_candidate.is_file() {
        return Some(markdown_candidate);
    }
    Some(normalize_document_order_target_path(
        &candidate.join("index.md"),
    ))
}

fn is_external_or_unsafe_vitepress_link(target: &str) -> bool {
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("//")
        || target.contains("://")
        || target.contains('\\')
        || looks_like_windows_drive_path(target)
}

fn looks_like_windows_drive_path(target: &str) -> bool {
    let bytes = target.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'/' || bytes[2] == b'\\')
}

struct StaticParser<'a> {
    source: &'a str,
    position: usize,
}

impl<'a> StaticParser<'a> {
    fn new(source: &'a str) -> Self {
        Self {
            source,
            position: 0,
        }
    }

    fn parse_value(&mut self) -> StaticValue {
        self.skip_ws_and_comments();
        match self.peek_char() {
            Some('{') => self.parse_object(),
            Some('[') => self.parse_array(),
            Some('"') | Some('\'') => self
                .parse_string()
                .map_or(StaticValue::Unsupported, StaticValue::String),
            Some('`') => {
                self.skip_template();
                StaticValue::Unsupported
            }
            Some('.') if self.remaining().starts_with("...") => {
                self.skip_value_boundary();
                StaticValue::Unsupported
            }
            Some(value) if is_identifier_start(value) => {
                let ident = self.parse_identifier().unwrap_or_default();
                self.skip_ws_and_comments();
                if self.peek_char() == Some('(') {
                    self.skip_balanced_call();
                    StaticValue::Unsupported
                } else {
                    StaticValue::Identifier(ident)
                }
            }
            Some(_) => {
                self.skip_value_boundary();
                StaticValue::Unsupported
            }
            None => StaticValue::Unsupported,
        }
    }

    fn parse_object(&mut self) -> StaticValue {
        self.consume_char();
        let mut entries = Vec::new();
        loop {
            self.skip_ws_and_comments();
            if self.peek_char() == Some('}') {
                self.consume_char();
                break;
            }
            let Some(key) = self.parse_property_key() else {
                self.skip_value_boundary();
                if self.peek_char() == Some(',') {
                    self.consume_char();
                    continue;
                }
                break;
            };
            self.skip_ws_and_comments();
            let value = if self.peek_char() == Some(':') {
                self.consume_char();
                self.parse_value()
            } else {
                StaticValue::Identifier(key.clone())
            };
            entries.push((key, value));
            self.skip_ws_and_comments();
            if self.peek_char() == Some(',') {
                self.consume_char();
            }
        }
        StaticValue::Object(entries)
    }

    fn parse_array(&mut self) -> StaticValue {
        self.consume_char();
        let mut values = Vec::new();
        loop {
            self.skip_ws_and_comments();
            if self.peek_char() == Some(']') {
                self.consume_char();
                break;
            }
            values.push(self.parse_value());
            self.skip_ws_and_comments();
            if self.peek_char() == Some(',') {
                self.consume_char();
            }
        }
        StaticValue::Array(values)
    }

    fn parse_property_key(&mut self) -> Option<String> {
        self.skip_ws_and_comments();
        match self.peek_char()? {
            '"' | '\'' => self.parse_string(),
            value if is_identifier_start(value) => self.parse_identifier(),
            _ => None,
        }
    }

    fn parse_identifier(&mut self) -> Option<String> {
        self.skip_ws_and_comments();
        let mut chars = self.remaining().char_indices();
        let (_, first) = chars.next()?;
        if !is_identifier_start(first) {
            return None;
        }
        let mut end = first.len_utf8();
        for (index, value) in chars {
            if !is_identifier_char(value) {
                break;
            }
            end = index + value.len_utf8();
        }
        let value = self.remaining()[..end].to_string();
        self.position += end;
        Some(value)
    }

    fn parse_string(&mut self) -> Option<String> {
        let quote = self.consume_char()?;
        let mut result = String::new();
        let mut escaped = false;
        while let Some(value) = self.consume_char() {
            if escaped {
                result.push(value);
                escaped = false;
                continue;
            }
            if value == '\\' {
                escaped = true;
                continue;
            }
            if value == quote {
                return Some(result);
            }
            result.push(value);
        }
        None
    }

    fn skip_until_equals(&mut self) -> bool {
        while let Some(value) = self.consume_char() {
            if value == '=' {
                return true;
            }
            if value == '\n' || value == ';' {
                return false;
            }
        }
        false
    }

    fn skip_ws_and_comments(&mut self) {
        loop {
            while self.peek_char().is_some_and(char::is_whitespace) {
                self.consume_char();
            }
            if self.remaining().starts_with("//") {
                while let Some(value) = self.consume_char() {
                    if value == '\n' {
                        break;
                    }
                }
                continue;
            }
            if self.remaining().starts_with("/*") {
                self.position += 2;
                while !self.remaining().is_empty() {
                    if self.remaining().starts_with("*/") {
                        self.position += 2;
                        break;
                    }
                    self.consume_char();
                }
                continue;
            }
            break;
        }
    }

    fn skip_template(&mut self) {
        self.consume_char();
        let mut escaped = false;
        while let Some(value) = self.consume_char() {
            if escaped {
                escaped = false;
            } else if value == '\\' {
                escaped = true;
            } else if value == '`' {
                break;
            }
        }
    }

    fn skip_balanced_call(&mut self) {
        if self.peek_char() != Some('(') {
            return;
        }
        let mut depth = 0usize;
        while let Some(value) = self.consume_char() {
            match value {
                '(' => depth += 1,
                ')' => {
                    depth = depth.saturating_sub(1);
                    if depth == 0 {
                        break;
                    }
                }
                '"' | '\'' => {
                    self.position = self.position.saturating_sub(value.len_utf8());
                    let _ = self.parse_string();
                }
                '`' => {
                    self.position = self.position.saturating_sub(value.len_utf8());
                    self.skip_template();
                }
                _ => {}
            }
        }
    }

    fn skip_value_boundary(&mut self) {
        while let Some(value) = self.peek_char() {
            if matches!(value, ',' | '}' | ']') {
                break;
            }
            self.consume_char();
        }
    }

    fn peek_char(&self) -> Option<char> {
        self.remaining().chars().next()
    }

    fn consume_char(&mut self) -> Option<char> {
        let value = self.peek_char()?;
        self.position += value.len_utf8();
        Some(value)
    }

    fn remaining(&self) -> &str {
        &self.source[self.position..]
    }
}

fn is_identifier_start(value: char) -> bool {
    value == '_' || value == '$' || value.is_ascii_alphabetic()
}

fn is_identifier_char(value: char) -> bool {
    is_identifier_start(value) || value.is_ascii_digit() || value == '-'
}

#[cfg(test)]
mod tests {
    use std::{fs, sync::Mutex};

    use tempfile::tempdir;

    use super::*;
    use crate::path_policy::path_for_policy;

    fn roots_for(path: &Path) -> AllowedRoots {
        AllowedRoots(Mutex::new([path_for_policy(path)].into_iter().collect()))
    }

    #[test]
    fn parses_static_array_sidebar() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        fs::create_dir_all(docs.join(".vitepress")).expect("config dir");
        fs::create_dir_all(docs.join("guide")).expect("guide");
        fs::write(docs.join("guide").join("index.md"), "# Guide").expect("index");
        fs::write(docs.join("guide").join("intro.md"), "# Intro").expect("intro");
        fs::write(
            docs.join(".vitepress").join("config.ts"),
            "export default { themeConfig: { sidebar: [{ text: 'Guide', items: [{ text: 'Intro', link: '/guide/intro#top' }, { text: 'Index', link: '/guide/' }] }] } }",
        )
        .expect("config");

        let result = load_vitepress_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Vitepress);
        let DocumentOrderNode::Section {
            title, children, ..
        } = &result.nodes[0]
        else {
            panic!("expected section");
        };
        assert_eq!(title, "Guide");
        assert_eq!(children.len(), 2);
        assert!(matches!(
            &children[0],
            DocumentOrderNode::Document {
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            }
        ));
    }

    #[test]
    fn parses_object_sidebar_from_top_level_identifier() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        fs::create_dir_all(docs.join(".vitepress")).expect("config dir");
        fs::create_dir_all(docs.join("reference")).expect("reference");
        fs::write(docs.join("reference").join("api.md"), "# API").expect("api");
        fs::write(
            docs.join(".vitepress").join("config.mts"),
            "export const sidebar = { '/reference/': [{ text: 'API', link: '/reference/api' }, { text: 'Missing', link: '/reference/missing' }] }\nexport default defineConfig({ themeConfig: { sidebar } })",
        )
        .expect("config");

        let result = load_vitepress_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::Vitepress);
        let DocumentOrderNode::Section {
            title, children, ..
        } = &result.nodes[0]
        else {
            panic!("expected section");
        };
        assert_eq!(title, "reference");
        assert!(matches!(
            &children[0],
            DocumentOrderNode::Document {
                status: DocumentOrderDocumentStatus::Resolved,
                ..
            }
        ));
        assert!(matches!(
            &children[1],
            DocumentOrderNode::Document {
                status: DocumentOrderDocumentStatus::Missing,
                ..
            }
        ));
    }

    #[test]
    fn rejects_dynamic_sidebar_without_executing_config() {
        let dir = tempdir().expect("tempdir");
        let docs = dir.path().join("docs");
        fs::create_dir_all(docs.join(".vitepress")).expect("config dir");
        fs::write(
            docs.join(".vitepress").join("config.js"),
            "export default { themeConfig: { sidebar: generateSidebar() } }",
        )
        .expect("config");

        let result = load_vitepress_order_from_root(dir.path(), &roots_for(dir.path()));

        assert_eq!(result.source, DocumentOrderSource::None);
        assert_eq!(
            result.message.as_deref(),
            Some("VitePress sidebar is not configured as a static value.")
        );
    }
}
