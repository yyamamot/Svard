use super::*;
use std::time::Instant;

const DEFAULT_REF_PAGE_LIMIT: usize = 20;
const MAX_REF_PAGE_LIMIT: usize = 50;

pub fn git_refs_for_path(
    path: &str,
    kind: GitRefKind,
    limit: Option<usize>,
    cursor: Option<&str>,
    query: Option<&str>,
) -> Result<GitRefList, String> {
    let started_at = Instant::now();
    if !is_supported_document_relative_path(path) {
        return Ok(empty_ref_list(
            GitRefListStatus::Unsupported,
            None,
            Some("Git ref compare is available for markup documents only.".to_string()),
        ));
    }
    let context = match git_context_for_path(path)? {
        GitPathContext::InRepo(context) => context,
        GitPathContext::NotInRepo => {
            return Ok(empty_ref_list(
                GitRefListStatus::NotInRepo,
                None,
                Some("Document is not inside a Git repository.".to_string()),
            ));
        }
    };
    let status = git_status_for_resolved_path(
        &context.repo,
        &context.absolute_path,
        &context.relative_path,
        &context.relative_path_display,
    )?;
    if status == GitDiffStatus::Untracked {
        return Ok(empty_ref_list(
            GitRefListStatus::Untracked,
            Some(context.relative_path_display),
            Some("This document is not tracked by Git yet.".to_string()),
        ));
    }

    let page = match kind {
        GitRefKind::Branch => branch_ref_items(&context.repo)?,
        GitRefKind::Tag => tag_ref_items(&context.repo)?,
        GitRefKind::Commit => {
            return commit_ref_page(
                &context.repo,
                context.relative_path_display,
                kind,
                limit,
                cursor,
                query,
                started_at,
            );
        }
    };
    let (items, has_more, next_cursor, stale_cursor) = ref_page(page, limit, cursor, query);

    Ok(GitRefList {
        status: GitRefListStatus::Ok,
        relative_path: Some(context.relative_path_display),
        metrics: Some(GitRefListMetrics {
            kind,
            duration_ms: started_at.elapsed().as_secs_f64() * 1000.0,
            returned_refs: items.len(),
            walked_commits: 0,
            has_more,
            cursor_present: Some(cursor.is_some()),
            stale_cursor: Some(stale_cursor),
        }),
        items,
        message: None,
        has_more: Some(has_more),
        next_cursor,
    })
}

pub(super) fn branch_ref_items(repo: &gix::Repository) -> Result<Vec<GitRefItem>, String> {
    let mut items = Vec::new();
    let references = repo
        .references()
        .map_err(|error| format!("failed to open Git references: {error}"))?;
    for reference in references
        .local_branches()
        .map_err(|error| format!("failed to list Git branches: {error}"))?
    {
        let reference =
            reference.map_err(|error| format!("failed to read Git reference: {error}"))?;
        if let Some(item) = ref_item_from_reference(reference, GitRefKind::Branch)? {
            items.push(item);
        }
    }
    let references = repo
        .references()
        .map_err(|error| format!("failed to open Git references: {error}"))?;
    for reference in references
        .remote_branches()
        .map_err(|error| format!("failed to list Git remote branches: {error}"))?
    {
        let reference =
            reference.map_err(|error| format!("failed to read Git reference: {error}"))?;
        let full_name = reference.name().as_bstr().to_string();
        if full_name.ends_with("/HEAD") {
            continue;
        }
        if let Some(item) = ref_item_from_reference(reference, GitRefKind::Branch)? {
            items.push(item);
        }
    }
    items.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(items)
}

fn tag_ref_items(repo: &gix::Repository) -> Result<Vec<GitRefItem>, String> {
    let references = repo
        .references()
        .map_err(|error| format!("failed to open Git references: {error}"))?;
    let mut items = Vec::new();
    for reference in references
        .tags()
        .map_err(|error| format!("failed to list Git tags: {error}"))?
    {
        let reference =
            reference.map_err(|error| format!("failed to read Git reference: {error}"))?;
        if let Some(item) = ref_item_from_reference(reference, GitRefKind::Tag)? {
            items.push(item);
        }
    }
    items.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(items)
}

fn commit_ref_page(
    repo: &gix::Repository,
    relative_path: String,
    kind: GitRefKind,
    limit: Option<usize>,
    cursor: Option<&str>,
    query: Option<&str>,
    started_at: Instant,
) -> Result<GitRefList, String> {
    let max_items = clamp_ref_page_limit(limit);
    let query = normalized_query(query);
    let head = repo
        .head_commit()
        .map_err(|error| format!("failed to read HEAD commit: {error}"))?;
    let walk = head
        .ancestors()
        .sorting(gix::revision::walk::Sorting::ByCommitTime(
            gix::traverse::commit::simple::CommitTimeOrder::NewestFirst,
        ))
        .all()
        .map_err(|error| format!("failed to walk Git history: {error}"))?;
    let mut items = Vec::new();
    let mut walked_commits = 0;
    let mut cursor_seen = cursor.is_none();
    let mut stale_cursor = false;
    for info in walk {
        let info = info.map_err(|error| format!("failed to read Git history: {error}"))?;
        walked_commits += 1;
        let commit = info
            .object()
            .map_err(|error| format!("failed to read commit object: {error}"))?;
        let revision = commit.id().to_string();
        if !cursor_seen {
            if Some(revision.as_str()) == cursor {
                cursor_seen = true;
            }
            continue;
        }
        let short = short_id_for_commit(&commit)?;
        let summary = commit_summary(&commit)?;
        let item = GitRefItem {
            kind: GitRefKind::Commit,
            name: short.clone(),
            revision,
            short_revision: short,
            summary: Some(summary),
        };
        if !matches_ref_query(&item, query.as_deref()) {
            continue;
        }
        items.push(item);
        if items.len() > max_items {
            break;
        }
    }
    if cursor.is_some() && !cursor_seen {
        stale_cursor = true;
        items.clear();
    }
    let has_more = items.len() > max_items;
    if has_more {
        items.truncate(max_items);
    }
    let next_cursor = if has_more {
        items.last().map(|item| item.revision.clone())
    } else {
        None
    };

    Ok(GitRefList {
        status: GitRefListStatus::Ok,
        relative_path: Some(relative_path),
        metrics: Some(GitRefListMetrics {
            kind,
            duration_ms: started_at.elapsed().as_secs_f64() * 1000.0,
            returned_refs: items.len(),
            walked_commits,
            has_more,
            cursor_present: Some(cursor.is_some()),
            stale_cursor: Some(stale_cursor),
        }),
        items,
        message: None,
        has_more: Some(has_more),
        next_cursor,
    })
}

fn ref_page(
    items: Vec<GitRefItem>,
    limit: Option<usize>,
    cursor: Option<&str>,
    query: Option<&str>,
) -> (Vec<GitRefItem>, bool, Option<String>, bool) {
    let max_items = clamp_ref_page_limit(limit);
    let query = normalized_query(query);
    let filtered: Vec<GitRefItem> = items
        .into_iter()
        .filter(|item| matches_ref_query(item, query.as_deref()))
        .collect();
    let mut start = 0;
    let mut stale_cursor = false;
    if let Some(cursor) = cursor {
        if let Some(position) = filtered.iter().position(|item| item.name == cursor) {
            start = position + 1;
        } else {
            stale_cursor = true;
        }
    }
    let mut page: Vec<GitRefItem> = filtered
        .into_iter()
        .skip(start)
        .take(max_items + 1)
        .collect();
    let has_more = page.len() > max_items;
    if has_more {
        page.truncate(max_items);
    }
    let next_cursor = if has_more {
        page.last().map(|item| item.name.clone())
    } else {
        None
    };
    (page, has_more, next_cursor, stale_cursor)
}

fn clamp_ref_page_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(DEFAULT_REF_PAGE_LIMIT)
        .clamp(1, MAX_REF_PAGE_LIMIT)
}

fn normalized_query(query: Option<&str>) -> Option<String> {
    let trimmed = query?.trim().to_lowercase();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn matches_ref_query(item: &GitRefItem, query: Option<&str>) -> bool {
    let Some(query) = query else {
        return true;
    };
    item.name.to_lowercase().contains(query)
        || item.revision.to_lowercase().contains(query)
        || item.short_revision.to_lowercase().contains(query)
        || item
            .summary
            .as_deref()
            .unwrap_or_default()
            .to_lowercase()
            .contains(query)
}

fn ref_item_from_reference(
    mut reference: gix::Reference<'_>,
    kind: GitRefKind,
) -> Result<Option<GitRefItem>, String> {
    let full_name = reference.name().as_bstr().to_string();
    let name = display_ref_name(&full_name, &kind);
    let id = match reference.peel_to_id() {
        Ok(id) => id,
        Err(_) => return Ok(None),
    };
    let commit = match id
        .object()
        .map_err(|error| format!("failed to read Git reference object: {error}"))?
        .try_into_commit()
    {
        Ok(commit) => commit,
        Err(_) => return Ok(None),
    };
    let short = short_id_for_commit(&commit)?;
    Ok(Some(GitRefItem {
        kind,
        name,
        revision: commit.id().to_string(),
        short_revision: short,
        summary: Some(commit_summary(&commit)?),
    }))
}

fn display_ref_name(full_name: &str, kind: &GitRefKind) -> String {
    match kind {
        GitRefKind::Branch => full_name
            .strip_prefix("refs/heads/")
            .or_else(|| full_name.strip_prefix("refs/remotes/"))
            .unwrap_or(full_name)
            .to_string(),
        GitRefKind::Tag => full_name
            .strip_prefix("refs/tags/")
            .unwrap_or(full_name)
            .to_string(),
        GitRefKind::Commit => full_name.to_string(),
    }
}

fn empty_ref_list(
    status: GitRefListStatus,
    relative_path: Option<String>,
    message: Option<String>,
) -> GitRefList {
    GitRefList {
        status,
        relative_path,
        items: Vec::new(),
        message,
        has_more: Some(false),
        next_cursor: None,
        metrics: None,
    }
}
