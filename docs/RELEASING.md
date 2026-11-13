# Releasing a new version

1. Make and test the change.
2. Raise `version` in `.claude-plugin/plugin.json` (Semantic Versioning: `1.0.1` for a fix, `1.1.0` for a feature).
3. Add an entry at the top of `CHANGELOG.md`.
4. Run `claude plugin validate .`
5. Commit, tag and push:

   ```bash
   git commit -am "Release 1.0.1"
   git tag v1.0.1
   git push
   git push --tags
   ```

6. Optional: on GitHub, **Releases → Draft a new release**, pick the tag, paste the changelog entry.

People who installed the mod get the new version with:

```bash
claude plugin update second-screen-preview
```

or from **/plugin** in a terminal session.
