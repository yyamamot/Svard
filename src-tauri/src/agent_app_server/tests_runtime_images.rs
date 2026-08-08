#[test]
fn image_normalization_accepts_png_and_rejects_unsupported_or_forged_inputs() {
    let image = DynamicImage::new_rgba8(3, 2);
    let mut source = Cursor::new(Vec::new());
    image.write_to(&mut source, ImageFormat::Png).unwrap();
    let normalized = normalize_agent_image(&source.into_inner()).unwrap();
    assert_eq!(normalized.media_type, "image/png");
    assert_eq!((normalized.width, normalized.height), (3, 2));
    assert!(normalized
        .thumbnail_data_url
        .starts_with("data:image/png;base64,"));

    assert!(normalize_agent_image(b"<svg xmlns='http://www.w3.org/2000/svg'/>").is_err());
    assert!(normalize_agent_image(b"GIF89a forged image").is_err());
    assert!(normalize_agent_image(b"\x89PNG\r\n\x1a\nnot a decoded PNG").is_err());
    assert_eq!(
        normalize_agent_image(&vec![0; MAX_IMAGE_SOURCE_BYTES + 1]).unwrap_err(),
        "This image is too large."
    );
}

#[test]
fn image_normalization_accepts_jpeg_and_webp() {
    let image = DynamicImage::new_rgb8(4, 3);
    for format in [ImageFormat::Jpeg, ImageFormat::WebP] {
        let mut source = Cursor::new(Vec::new());
        image.write_to(&mut source, format).unwrap();
        let normalized = normalize_agent_image(&source.into_inner()).unwrap();
        assert_eq!(normalized.media_type, "image/jpeg");
        assert_eq!((normalized.width, normalized.height), (4, 3));
    }
}

#[test]
fn image_dimensions_are_limited_before_full_decode() {
    fn crc32(bytes: &[u8]) -> u32 {
        let mut crc = 0xffff_ffff_u32;
        for byte in bytes {
            crc ^= u32::from(*byte);
            for _ in 0..8 {
                crc = if crc & 1 == 1 {
                    (crc >> 1) ^ 0xedb8_8320
                } else {
                    crc >> 1
                };
            }
        }
        !crc
    }

    let image = DynamicImage::new_rgba8(1, 1);
    let mut source = Cursor::new(Vec::new());
    image.write_to(&mut source, ImageFormat::Png).unwrap();
    let mut bytes = source.into_inner();
    bytes[16..20].copy_from_slice(&7_000_u32.to_be_bytes());
    bytes[20..24].copy_from_slice(&6_000_u32.to_be_bytes());
    let crc = crc32(&bytes[12..29]);
    bytes[29..33].copy_from_slice(&crc.to_be_bytes());

    assert_eq!(
        normalize_agent_image(&bytes).unwrap_err(),
        "This image has too many pixels."
    );
}

#[test]
fn consumed_images_do_not_block_staging_for_the_next_question() {
    let staged_image =
        |attachment_id: &str, byte_length: usize, consumed_by: Option<&str>| StagedAgentImage {
            attachment: AgentImageAttachment {
                attachment_id: attachment_id.to_string(),
                display_label: format!("{attachment_id}.png"),
                media_type: "image/png",
                width: 1,
                height: 1,
                byte_length,
                thumbnail_data_url: "data:image/png;base64,preview".to_string(),
            },
            path: PathBuf::from(format!("/private/{attachment_id}.png")),
            digest: attachment_id.to_string(),
            consumed_by: consumed_by.map(str::to_string),
        };
    let staged = HashMap::from([
        (
            "current-turn".to_string(),
            staged_image("current-turn", 1024, Some("active-turn")),
        ),
        (
            "next-question".to_string(),
            staged_image("next-question", 2048, None),
        ),
    ]);

    assert_eq!(pending_image_usage(&staged), (1, 2048));
}

#[test]
fn clipboard_image_input_accepts_the_frontend_camel_case_payload() {
    let input: AgentImageStageInput = serde_json::from_value(json!({
        "clientSessionId": "session",
        "source": {
            "kind": "clipboardBytes",
            "displayLabel": "image.png",
            "mediaType": "image/png",
            "base64": "cG5n"
        }
    }))
    .unwrap();

    assert_eq!(input.client_session_id, "session");
    match input.source {
        AgentImageStageSource::ClipboardBytes {
            display_label,
            media_type,
            base64,
        } => {
            assert_eq!(display_label, "image.png");
            assert_eq!(media_type, "image/png");
            assert_eq!(base64, "cG5n");
        }
        AgentImageStageSource::SelectedPath { .. } => {
            panic!("clipboard payload selected the wrong source variant")
        }
    }
}

#[test]
fn mixed_turn_input_accepts_the_frontend_camel_case_payload() {
    let input: AgentTurnInput = serde_json::from_value(json!({
        "clientSessionId": "session",
        "clientTurnId": "turn",
        "question": "Inspect the selected content.",
        "responseMode": "auto",
        "focusFiles": [],
        "imageAttachmentIds": ["image-1"],
        "contentParts": [
            { "type": "text", "text": "Before image" },
            { "type": "image", "attachmentId": "image-1" },
            { "type": "text", "text": "After image" }
        ]
    }))
    .unwrap();

    assert_eq!(input.content_parts.len(), 3);
    assert!(matches!(
        &input.content_parts[1],
        AgentTurnContentPart::Image { attachment_id }
            if attachment_id == "image-1"
    ));
}

#[test]
fn agent_events_serialize_variant_fields_in_frontend_camel_case() {
    let accepted = serde_json::to_value(AgentEvent::TurnInputAccepted {
        client_turn_id: "turn-1".to_string(),
        image_attachment_ids: vec!["image-1".to_string()],
    })
    .unwrap();
    assert_eq!(accepted["type"], "turnInputAccepted");
    assert_eq!(accepted["clientTurnId"], "turn-1");
    assert_eq!(accepted["imageAttachmentIds"][0], "image-1");
    assert!(accepted.get("client_turn_id").is_none());
    assert!(accepted.get("image_attachment_ids").is_none());

    let title = serde_json::to_value(AgentEvent::SessionTitleUpdated {
        client_session_id: "session-1".to_string(),
        title: "AI Chat titles".to_string(),
    })
    .unwrap();
    assert_eq!(title["type"], "sessionTitleUpdated");
    assert_eq!(title["clientSessionId"], "session-1");
    assert_eq!(title["title"], "AI Chat titles");
    assert!(title.get("client_session_id").is_none());

    let tool = serde_json::to_value(AgentEvent::ToolStarted {
        tool_id: "tool-1".to_string(),
        kind: "read",
        category: "read",
        title: "Reading a file".to_string(),
        visibility: "user",
        target: Some("docs/guide.md".to_string()),
        detail: None,
    })
    .unwrap();
    assert_eq!(tool["toolId"], "tool-1");
    assert_eq!(tool["category"], "read");
    assert_eq!(tool["visibility"], "user");
    assert_eq!(tool["target"], "docs/guide.md");
    assert!(tool.get("tool_id").is_none());
}

#[test]
fn image_turn_input_follows_text_without_exposing_an_attachment_id() {
    let items = turn_input_items(
        "Inspect this image.",
        &[],
        &[(
            "opaque-image-id".to_string(),
            PathBuf::from("/private/session/image-1.png"),
        )],
    )
    .unwrap();
    assert_eq!(items[0]["type"], "text");
    assert_eq!(items[1]["type"], "localImage");
    assert_eq!(items[1]["detail"], "auto");
    assert!(!items[1].to_string().contains("opaque-image-id"));
}

#[test]
fn mixed_turn_input_preserves_text_image_text_order() {
    let items = turn_input_items(
        "Question",
        &[
            AgentTurnContentPart::Text {
                text: "Before image".to_string(),
            },
            AgentTurnContentPart::Image {
                attachment_id: "image-1".to_string(),
            },
            AgentTurnContentPart::Text {
                text: "After image".to_string(),
            },
        ],
        &[(
            "image-1".to_string(),
            PathBuf::from("/private/session/image-1.png"),
        )],
    )
    .unwrap();
    assert_eq!(items[0]["text"], "Question");
    assert_eq!(items[1]["text"], "Before image");
    assert_eq!(items[2]["type"], "localImage");
    assert_eq!(items[3]["text"], "After image");
}

#[test]
fn auto_and_visualize_turns_receive_distinct_guidance() {
    let auto = turn_prompt(
        "",
        "",
        "Explain the workspace.",
        AgentResponseMode::Auto,
        "question",
        "OPENUI COMPONENTS",
    );
    assert!(auto.contains(AUTO_RESPONSE_INSTRUCTION));
    assert!(!auto.contains("OPENUI COMPONENTS"));
    assert!(!auto.contains("SvardExperience"));

    let visualize = turn_prompt(
        "",
        "",
        "Visualize the workspace.",
        AgentResponseMode::Visualize,
        "question",
        "OPENUI COMPONENTS",
    );
    assert!(visualize.contains(VISUALIZE_RESPONSE_INSTRUCTION));
    assert!(visualize.contains("OPENUI COMPONENTS"));
    assert!(auto.ends_with("Explain the workspace."));
    assert!(visualize.ends_with("Visualize the workspace."));
}

#[cfg(unix)]
fn panic_stdin() -> ChildStdin {
    let mut child = Command::new("sh")
        .args(["-c", "cat >/dev/null"])
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap()
}

#[cfg(windows)]
fn panic_stdin() -> ChildStdin {
    let mut child = Command::new("cmd")
        .args(["/C", "more >NUL"])
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap()
}

fn test_channel(sender: mpsc::Sender<Value>) -> Channel<AgentEventEnvelope> {
    Channel::new(move |body| {
        if let tauri::ipc::InvokeResponseBody::Json(value) = body {
            if let Ok(envelope) = serde_json::from_str::<Value>(&value) {
                let _ = sender.send(envelope["event"].clone());
            }
        }
        Ok(())
    })
}
