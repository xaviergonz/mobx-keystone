# Change Log

## 0.0.1 (unreleased)

- Refactored internal synchronization to use deep change observation instead of JSON patches. This provides proper array splice detection, avoiding the previous behavior where array operations were converted to individual element patches. The result is more efficient array synchronization and better alignment with how Loro handles array modifications.
- Initial release of `mobx-keystone-loro`.
