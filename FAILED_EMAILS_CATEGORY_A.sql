-- 类别A失败邮件UID清单（HTML复杂表格解析失败）
-- 数量: 约4,200封
-- 特征: 只有HTML正文，缺少unitNav字段

SELECT emailUid, subject, createdAt
FROM EmailParseResult
WHERE errorReason = '数据清洗失败(提取1行,落库0行)'
AND subject LIKE '%净值表%'
ORDER BY createdAt DESC
LIMIT 100;
