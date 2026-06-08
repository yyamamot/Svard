use std::{collections::BTreeSet, path::PathBuf, sync::Mutex};

#[derive(Default)]
pub(crate) struct AllowedRoots(pub(crate) Mutex<BTreeSet<PathBuf>>);
