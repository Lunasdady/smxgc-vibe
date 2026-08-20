---
name: test-script-archiver
description: Archive temporary test scripts and documentation files after use. Moves test scripts (`.js`, `.ts`) to `_archive-scripts/` and markdown reports (`.md`) to `_archive-docs/`. Use after completing testing, verification, debugging, or generating fix reports.
---

# Test Script Archiver

自动归档临时测试脚本和文档报告，保持项目目录整洁。

## When to Use

在完成以下任务后使用：
- 测试验证（验证修复效果、检查数据状态）
- 问题诊断（分析问题原因、排查bug）
- 临时脚本（一次性使用的分析/验证脚本）
- 调试脚本（调试过程中生成的测试代码）
- **文档报告**（修复报告、优化说明、验证文档等 `.md` 文件）

## Archive Workflow

### Step 1: 识别测试脚本

查找根目录下的临时测试脚本：

```bash
# 查找JavaScript/TypeScript测试脚本
ls -1 *.js *.ts *.mjs 2>/dev/null | grep -E "(test|check|verify|analyze|debug|reparse|extract)" | grep -v "node_modules"
```

### Step 2: 创建归档目录

```bash
mkdir -p _archive-scripts _archive-docs
```

### Step 3: 移动测试脚本

```bash
# 移动所有测试脚本到归档目录
mv test-*.js verify-*.js analyze-*.js check-*.js debug-*.js _archive-scripts/ 2>/dev/null || true
mv *.test.js *.check.js *.verify.js _archive-scripts/ 2>/dev/null || true
```

### Step 4: 移动文档报告

查找并移动根目录下的临时文档报告：

```bash
# 查找修复报告、优化说明等临时文档
ls -1 *.md 2>/dev/null | grep -ivE "^(README|CHANGELOG|LICENSE|HANDOFF|UPGRADE)\.md$" | grep -iE "(fix|report|summary|changelog|upgrade|summary|note|doc)"
```

移动文档到归档目录：

```bash
# 移动所有临时文档报告
mv *-FIX*.md *-REPORT*.md *-SUMMARY*.md *-NOTE*.md *-UPGRADE*.md _archive-docs/ 2>/dev/null || true
mv fix-*.md report-*.md summary-*.md changelog-*.md upgrade-*.md _archive-docs/ 2>/dev/null || true
```

**保留的核心文档**（不移动）：
- `README.md` - 项目说明
- `CHANGELOG.md` - 版本更新日志
- `LICENSE` - 许可证
- `HANDOFF.md` - 交接文档
- `UPGRADE.md` - 升级指南

### Step 5: 验证归档

```bash
# 确认脚本已移动
echo "=== 测试脚本归档 ==="
ls _archive-scripts/ 2>/dev/null || echo "(空)"

# 确认文档已移动
echo "=== 文档报告归档 ==="
ls _archive-docs/ 2>/dev/null || echo "(空)"

# 确认根目录已清理
echo "=== 根目录检查 ==="
ls *.js *.ts 2>/dev/null | grep -E "(test|verify|analyze|check|debug)" || echo "✓ 测试脚本已清理"
ls *.md 2>/dev/null | grep -ivE "^(README|CHANGELOG|LICENSE|HANDOFF|UPGRADE)\.md$" | grep -iE "(fix|report|summary|changelog|upgrade|summary|note|doc)" || echo "✓ 文档报告已清理"
```

## Script Naming Convention

归档脚本保留原有命名，常见模式：
- `test-*.js/ts` - 测试脚本
- `verify-*.js/ts` - 验证脚本
- `analyze-*.js/ts` - 分析脚本
- `check-*.js/ts` - 检查脚本
- `debug-*.js/ts` - 调试脚本
- `reparse-*.js/ts` - 重新解析脚本
- `extract-*.js/ts` - 提取脚本

## Important Notes

**测试脚本归档**：
- **只归档临时脚本**：不要移动项目核心文件（如 `package.json`, `next.config.js`）
- **保留日志文件**：`.log` 文件通常不需要归档
- **检查脚本用途**：如果脚本可能被重复使用，询问用户是否保留

**文档报告归档**：
- **保留核心文档**：`README.md`, `CHANGELOG.md`, `LICENSE`, `HANDOFF.md`, `UPGRADE.md`
- **归档临时报告**：修复报告、优化说明、验证文档等一次性文档
- **判断标准**：包含 `FIX`, `REPORT`, `SUMMARY`, `NOTE`, `UPGRADE` 等关键词的 `.md` 文件

**Git忽略**：
- `_archive-scripts/` 和 `_archive-docs/` 已在 `.gitignore` 中配置，无需重复添加

## Example

```bash
# 完成测试验证和修复报告后
mkdir -p _archive-scripts _archive-docs

# 移动测试脚本
mv test-fix-verification.js _archive-scripts/
mv verify-deployment.sh _archive-scripts/
mv analyze-empty-nav.ts _archive-scripts/

# 移动文档报告
mv HTML_PARSER_FIX_REPORT.md _archive-docs/
mv EMPTY_NAV_FIX_SUMMARY.md _archive-docs/
mv NAV_VALIDATION_FIX_REPORT.md _archive-docs/

# 验证
echo "=== 测试脚本 ==="
ls _archive-scripts/
# 输出: test-fix-verification.js  verify-deployment.sh  analyze-empty-nav.ts

echo "=== 文档报告 ==="
ls _archive-docs/
# 输出: HTML_PARSER_FIX_REPORT.md  EMPTY_NAV_FIX_SUMMARY.md  NAV_VALIDATION_FIX_REPORT.md
```
