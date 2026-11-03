//! Bridle canonical model (`bridle-canon`, architecture section 16): the schemars structs,
//! the `canon/1` identifiers, result frames, hashes and ids.
//!
//! This is the workspace skeleton's hello crate: it names the canon version and nothing else.
//! The real types arrive with the schema package.

/// The canonical model version every artifact of this workspace is tagged with.
pub const CANON_VERSION: &str = "canon/1";

/// Returns the canonical model version, `"canon/1"`.
///
/// ```
/// assert_eq!(bridle_canon::canon_version(), "canon/1");
/// ```
pub fn canon_version() -> &'static str {
    CANON_VERSION
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canon_version_is_canon_1() {
        assert_eq!(canon_version(), "canon/1");
        assert_eq!(CANON_VERSION, "canon/1");
    }
}
