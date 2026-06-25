use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum StaticValue {
    Object(Vec<(String, StaticValue)>),
    Array(Vec<StaticValue>),
    String(String),
    Number(f64),
    Identifier(String),
    Unsupported,
}

pub(crate) fn collect_static_bindings(source: &str) -> BTreeMap<String, StaticValue> {
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

pub(crate) fn object_property<'a>(value: &'a StaticValue, key: &str) -> Option<&'a StaticValue> {
    let StaticValue::Object(entries) = value else {
        return None;
    };
    entries
        .iter()
        .find_map(|(entry_key, entry_value)| (entry_key == key).then_some(entry_value))
}

pub(crate) fn static_array(value: &StaticValue) -> Option<&[StaticValue]> {
    match value {
        StaticValue::Array(items) => Some(items),
        _ => None,
    }
}

pub(crate) fn static_string(value: &StaticValue) -> Option<&str> {
    match value {
        StaticValue::String(value) => Some(value),
        _ => None,
    }
}

pub(crate) fn is_word_boundary(source: &str, start: usize, len: usize) -> bool {
    let before = source[..start].chars().next_back();
    let after = source[start + len..].chars().next();
    !before.is_some_and(is_identifier_char) && !after.is_some_and(is_identifier_char)
}

pub(crate) struct StaticParser<'a> {
    source: &'a str,
    position: usize,
}

impl<'a> StaticParser<'a> {
    pub(crate) fn new(source: &'a str) -> Self {
        Self {
            source,
            position: 0,
        }
    }

    pub(crate) fn parse_value(&mut self) -> StaticValue {
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
            Some(value) if value == '-' || value.is_ascii_digit() => self
                .parse_number()
                .map_or(StaticValue::Unsupported, StaticValue::Number),
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

    pub(crate) fn parse_identifier(&mut self) -> Option<String> {
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

    fn parse_number(&mut self) -> Option<f64> {
        let mut end = 0usize;
        for (index, value) in self.remaining().char_indices() {
            if !(value == '-' || value == '.' || value.is_ascii_digit()) {
                break;
            }
            end = index + value.len_utf8();
        }
        let value = self.remaining()[..end].parse::<f64>().ok()?;
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

    pub(crate) fn skip_until_equals(&mut self) -> bool {
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

    pub(crate) fn skip_ws_and_comments(&mut self) {
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

    pub(crate) fn peek_char(&self) -> Option<char> {
        self.remaining().chars().next()
    }

    pub(crate) fn consume_char(&mut self) -> Option<char> {
        let value = self.peek_char()?;
        self.position += value.len_utf8();
        Some(value)
    }

    pub(crate) fn remaining(&self) -> &str {
        &self.source[self.position..]
    }
}

fn is_identifier_start(value: char) -> bool {
    value == '_' || value == '$' || value.is_ascii_alphabetic()
}

fn is_identifier_char(value: char) -> bool {
    is_identifier_start(value) || value.is_ascii_digit() || value == '-'
}
