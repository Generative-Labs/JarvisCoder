# 代码格式化配置指南

本项目已经配置了自动代码格式化和linting规则，以解决代码规范问题。

## 已配置的工具

### Prettier

- 自动格式化代码
- 修复缩进问题
- 统一代码风格

### ESLint

- 检查代码质量
- 修复常见问题（如分号、变量声明等）
- TypeScript特定规则

## 使用方法

### 自动格式化（推荐）

1. 确保安装了 Prettier - Code formatter 扩展
2. 保存文件时会自动格式化并修复ESLint问题

### 手动格式化

```bash
# 格式化所有代码文件
npm run format

# 检查格式是否正确
npm run format:check

# 修复ESLint问题
npm run lint:fix

# 一键修复所有问题
npm run fix-all
```

## 安装依赖

运行以下命令安装新的依赖：

```bash
npm install
```

## 解决的问题

1. **缩进问题**: 统一使用2个空格缩进
2. **分号问题**: 自动添加缺失的分号
3. **Unicode字符**: 检测和报告异常unicode字符
4. **Switch语句**: 修复case块中的变量声明问题
5. **版权声明**: 提供文件头模板（需要手动添加到新文件）

## 版权声明模板

新文件应该包含以下版权声明（参考 `.file-header-template`）：

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
```

## 配置文件说明

- `.prettierrc.json`: Prettier配置
- `.prettierignore`: Prettier忽略文件
- `eslint.config.mjs`: ESLint配置
- `.vscode/settings.json`: VSCode编辑器设置
- `.file-header-template`: 文件头模板
