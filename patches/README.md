# Patch 文件说明

## gettingStarted.patch

这个 patch 文件包含了 `gettingStarted.ts` 的自定义修改，用于防止在同步 stream 分支时被覆盖。

### 使用方法

1. 在同步 stream 分支后，应用 patch：

   ```bash
   git apply patches/gettingStarted.patch
   ```

2. 如果出现冲突，手动解决冲突后：
   ```bash
   git add src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
   git commit -m "chore: reapply getting started page customization"
   ```

## product.patch

这个 patch 文件包含了 `product.json` 的自定义修改，用于自定义产品信息。

### 使用方法

1. 在同步 stream 分支后，应用 patch：

   ```bash
   git apply patches/product.patch
   ```

2. 如果出现冲突，手动解决冲突后：
   ```bash
   git add product.json
   git commit -m "chore: reapply product customization"
   ```

## product_type.patch

这个 patch 文件包含了 `product.type.ts` 的自定义修改，用于自定义产品类型定义。

### 使用方法

1. 在同步 stream 分支后，应用 patch：

   ```bash
   git apply patches/product_type.patch
   ```

2. 如果出现冲突，手动解决冲突后：
   ```bash
   git add src/vs/platform/product/common/product.type.ts
   git commit -m "chore: reapply product type customization"
   ```

### 注意事项

- 每次同步 stream 分支后都需要重新应用所有 patch
- 如果 patch 文件失效，需要重新生成
- 建议在应用 patch 前先备份当前修改
- 应用 patch 的顺序建议为：
  1. product_type.patch
  2. product.patch
  3. gettingStarted.patch
